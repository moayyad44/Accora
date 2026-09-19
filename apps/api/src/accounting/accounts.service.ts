import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountType, NormalBalance, Prisma } from "@prisma/client";

export interface CreateAccountInput {
  code: string;
  name: string;
  nameAr?: string;
  parentId?: string | null;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isHeader?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  nameAr?: string;
  isActive?: boolean;
}

@Injectable()
export class AccountsService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.account.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateAccountInput) {
    const existing = await tx.account.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Account code ${input.code} already exists`);

    if (input.parentId) {
      const parent = await tx.account.findFirst({ where: { id: input.parentId, companyId } });
      if (!parent) throw new NotFoundException("Parent account not found");
      if (!parent.isHeader) {
        throw new BadRequestException("Parent account must be a header account (isHeader = true)");
      }
    }

    return tx.account.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        nameAr: input.nameAr,
        parentId: input.parentId ?? null,
        accountType: input.accountType,
        normalBalance: input.normalBalance,
        isHeader: input.isHeader ?? false,
      },
    });
  }

  async update(tx: Prisma.TransactionClient, companyId: string, accountId: string, input: UpdateAccountInput) {
    const account = await tx.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new NotFoundException("Account not found");
    return tx.account.update({ where: { id: accountId }, data: input });
  }

  /** Validates an account is a real, active, postable (non-header) account
   * belonging to this company — the check every posting flow must run
   * before accepting a journal line against it. */
  async requirePostable(tx: Prisma.TransactionClient, companyId: string, accountId: string) {
    const account = await tx.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new BadRequestException(`Account ${accountId} not found in this company`);
    if (!account.isActive) throw new BadRequestException(`Account ${account.code} (${account.name}) is inactive`);
    if (account.isHeader) {
      throw new BadRequestException(`Account ${account.code} (${account.name}) is a header account and cannot be posted to directly`);
    }
    return account;
  }
}
