import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface NewCompanyInput {
  name: string;
  nameAr?: string;
  country?: string;
  baseCurrencyCode: string;
}

export interface NewCompanyResult {
  companyId: string;
  companyAdminRoleId: string;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a brand-new tenant: the Company row itself, its settings, its
   * OWN copy of the default chart of accounts (cloned from AccountTemplate),
   * and its OWN copy of the standard roles (cloned from RoleTemplate, with
   * their permissions). From this point on the company's accounts and roles
   * are completely independent rows that company can freely edit — the
   * templates are only ever a starting point, never referenced again.
   *
   * Must run inside a transaction whose tenant context is already scoped to
   * the caller's identity (userId) but with companyId still null/empty —
   * see AuthService.registerCompany, the only caller. Once the Company row
   * exists we immediately re-point the session's company context at it via
   * `prisma.setSessionContext`, because every table we insert into next
   * (company_settings, accounts, roles, role_permissions) is RLS-protected
   * and requires that context to accept the write.
   */
  async createCompany(
    tx: Prisma.TransactionClient,
    input: NewCompanyInput,
    actingUserId: string,
  ): Promise<NewCompanyResult> {
    const baseCurrency = await tx.currency.findUnique({ where: { code: input.baseCurrencyCode } });
    if (!baseCurrency) {
      throw new BadRequestException(`Unknown currency code: ${input.baseCurrencyCode}`);
    }

    const companyId = randomUUID();
    await tx.company.create({
      data: {
        id: companyId,
        name: input.name,
        nameAr: input.nameAr,
        country: input.country,
      },
    });

    // From here on every insert is into an RLS-protected, company-scoped
    // table, so the session's tenant context must point at the new company.
    await this.prisma.setSessionContext(tx, { companyId, userId: actingUserId });

    await tx.companySetting.create({
      data: { companyId, baseCurrencyId: baseCurrency.id },
    });

    const codeToAccountId = await this.cloneChartOfAccounts(tx, companyId);
    await this.seedDefaultAccountMappings(tx, companyId, codeToAccountId);
    const companyAdminRoleId = await this.cloneRoleTemplates(tx, companyId);

    return { companyId, companyAdminRoleId };
  }

  /** Returns the map of template account code -> newly created Account id,
   * so callers (seedDefaultAccountMappings) can wire company-level default
   * accounts to specific cloned accounts without a second DB round trip. */
  private async cloneChartOfAccounts(tx: Prisma.TransactionClient, companyId: string): Promise<Map<string, string>> {
    const template = await tx.accountTemplate.findUnique({
      where: { name: "Standard Template" },
      include: { lines: true },
    });
    if (!template) {
      throw new NotFoundException(
        "No account template found — run `pnpm prisma:seed` to load the default chart of accounts before creating companies",
      );
    }

    // Pass 1: create every account with no parent yet, remembering
    // template-code -> new-account-id so pass 2 can wire up the hierarchy.
    const codeToId = new Map<string, string>();
    for (const line of template.lines) {
      const account = await tx.account.create({
        data: {
          companyId,
          code: line.code,
          name: line.name,
          nameAr: line.nameAr,
          accountType: line.accountType,
          normalBalance: line.normalBalance,
          isHeader: line.isHeader,
        },
      });
      codeToId.set(line.code, account.id);
    }

    // Pass 2: set parentId for every line that had a parentCode.
    for (const line of template.lines) {
      if (!line.parentCode) continue;
      const parentId = codeToId.get(line.parentCode);
      const childId = codeToId.get(line.code);
      if (!parentId || !childId) continue;
      await tx.account.update({ where: { id: childId }, data: { parentId } });
    }

    return codeToId;
  }

  /**
   * Configures the company-wide default GL accounts (docs/ARCHITECTURE.md
   * §5: "الحسابات الافتراضية قابلة للتهيئة لكل شركة... لا شيء hardcoded").
   * These are the accounts Sales/Purchasing (Phase 5) post to when a
   * customer/supplier/item doesn't specify a more specific override — never
   * hardcoded account IDs inside the posting logic itself. Every mapping
   * created here remains freely editable afterwards via
   * PATCH /accounting/account-mappings/:key.
   */
  private async seedDefaultAccountMappings(
    tx: Prisma.TransactionClient,
    companyId: string,
    codeToAccountId: Map<string, string>,
  ) {
    const mappings: { key: string; code: string }[] = [
      { key: "DEFAULT_AR", code: "1131" }, // Trade Receivables
      { key: "DEFAULT_AP", code: "2111" }, // Trade Payables
      { key: "DEFAULT_SALES_REVENUE", code: "4100" }, // Sales Revenue
      { key: "DEFAULT_INVENTORY", code: "1144" }, // Trading Goods Inventory
      { key: "DEFAULT_COGS", code: "5110" }, // COGS - Trading
      { key: "DEFAULT_INVENTORY_ADJUSTMENT", code: "5480" }, // Inventory Adjustments
      { key: "DEFAULT_TAX_PAYABLE", code: "2120" }, // Tax Payable
    ];

    for (const m of mappings) {
      const accountId = codeToAccountId.get(m.code);
      if (!accountId) continue; // template changed and no longer has this code — skip rather than fail company creation
      await tx.accountMapping.create({ data: { companyId, key: m.key, accountId } });
    }
  }

  /** Returns the new company's own "Company Admin" role id. */
  private async cloneRoleTemplates(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const templates = await tx.roleTemplate.findMany({ include: { permissions: true } });
    let companyAdminRoleId: string | null = null;

    for (const template of templates) {
      const role = await tx.role.create({
        data: {
          companyId,
          name: template.name,
          nameAr: template.nameAr,
          description: template.description,
          isSystem: true,
        },
      });
      if (template.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: template.permissions.map((p) => ({ roleId: role.id, permissionId: p.permissionId })),
        });
      }
      if (template.name === "Company Admin") companyAdminRoleId = role.id;
    }

    if (!companyAdminRoleId) {
      throw new NotFoundException(
        "No 'Company Admin' role template found — run `pnpm prisma:seed` before creating companies",
      );
    }
    return companyAdminRoleId;
  }

  /** Companies the given user currently has active access to — a
   * cross-tenant-by-design read, see the refine_user_company_access_rls
   * migration for why this is safe under RLS.
   *
   * Deliberately does NOT join to `role` here: roles.id is company-scoped
   * RLS'd (a role only becomes visible once that specific company is the
   * active tenant context), but this method runs precisely when NO company
   * context is set yet (before login has picked one). Only `roleId` is
   * returned; the role's name/permissions are fetched via GET /roles once
   * the caller has switched into that company. `company` is safe to join
   * because the `companies` table itself is not RLS-protected (see
   * docs/DATABASE.md §3.3). */
  async listMyCompanies(tx: Prisma.TransactionClient, userId: string) {
    const access = await tx.userCompanyAccess.findMany({
      where: { userId, isActive: true },
      include: { company: true },
    });
    return access.map((a) => ({
      companyId: a.companyId,
      companyName: a.company.name,
      roleId: a.roleId,
    }));
  }
}
