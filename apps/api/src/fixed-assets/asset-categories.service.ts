import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DepreciationMethod, Prisma } from "@prisma/client";
import { AccountsService } from "../accounting/accounts.service";

export interface CreateAssetCategoryInput {
  name: string;
  nameAr?: string;
  defaultDepreciationMethod?: DepreciationMethod;
  defaultUsefulLifeMonths: number;
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
}

/**
 * An asset category (e.g. "Vehicles", "Machinery") carries its own three GL
 * accounts (docs/ARCHITECTURE.md §9) rather than resolving them through
 * AccountMappingsService's generic keys — different categories legitimately
 * post to different accounts (a vehicle and a building don't share one
 * "fixed assets" account), so the mapping has to be per-category, not
 * per-company.
 */
@Injectable()
export class AssetCategoriesService {
  constructor(private readonly accountsService: AccountsService) {}

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.assetCategory.findMany({
      where: { companyId },
      include: { assetAccount: true, depreciationExpenseAccount: true, accumulatedDepreciationAccount: true },
      orderBy: { name: "asc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, categoryId: string) {
    const category = await tx.assetCategory.findFirst({
      where: { id: categoryId, companyId },
      include: { assetAccount: true, depreciationExpenseAccount: true, accumulatedDepreciationAccount: true },
    });
    if (!category) throw new NotFoundException("Asset category not found");
    return category;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateAssetCategoryInput) {
    if (input.defaultUsefulLifeMonths <= 0) {
      throw new BadRequestException("defaultUsefulLifeMonths must be greater than zero");
    }
    const existing = await tx.assetCategory.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Asset category "${input.name}" already exists`);

    await this.accountsService.requirePostable(tx, companyId, input.assetAccountId);
    await this.accountsService.requirePostable(tx, companyId, input.depreciationExpenseAccountId);
    await this.accountsService.requirePostable(tx, companyId, input.accumulatedDepreciationAccountId);

    return tx.assetCategory.create({
      data: {
        companyId,
        name: input.name,
        nameAr: input.nameAr,
        defaultDepreciationMethod: input.defaultDepreciationMethod ?? DepreciationMethod.STRAIGHT_LINE,
        defaultUsefulLifeMonths: input.defaultUsefulLifeMonths,
        assetAccountId: input.assetAccountId,
        depreciationExpenseAccountId: input.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: input.accumulatedDepreciationAccountId,
      },
      include: { assetAccount: true, depreciationExpenseAccount: true, accumulatedDepreciationAccount: true },
    });
  }
}
