import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetTransactionType, DepreciationMethod, FixedAssetStatus, JournalSourceType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService, PostingLineInput } from "../accounting/journal-entries.service";
import { NumberingService } from "../accounting/numbering.service";

export interface RegisterFixedAssetInput {
  categoryId: string;
  name: string;
  nameAr?: string;
  purchaseDate: Date;
  usageStartDate?: Date;
  cost: string;
  salvageValue?: string;
  usefulLifeMonths?: number;
  depreciationMethod?: DepreciationMethod;
  /** The account this asset was paid from/for — cash, a bank account, or
   * accounts payable if bought on credit. Every acquisition needs a clear
   * traceable other side, exactly like a purchase invoice does. */
  fundingAccountId: string;
}

export interface DisposeFixedAssetInput {
  disposalDate: Date;
  /** What was received for the asset, if anything — defaults to 0 (e.g.
   * scrapped). */
  proceeds?: string;
  /** Required only when proceeds > 0 — the account the proceeds landed in
   * (cash, bank, a receivable). */
  proceedsAccountId?: string;
  notes?: string;
}

/**
 * Registers and lists fixed assets. Registration is the acquisition event:
 * it puts the asset on the books (DR the category's asset account) against
 * wherever it was paid from (CR fundingAccountId) in one posted journal
 * entry — never a bare database row with no accounting effect.
 */
@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly numberingService: NumberingService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string, status?: FixedAssetStatus) {
    return tx.fixedAsset.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, assetId: string) {
    const asset = await tx.fixedAsset.findFirst({
      where: { id: assetId, companyId },
      include: {
        category: true,
        depreciationSchedules: { include: { period: true }, orderBy: { period: { startDate: "asc" } } },
        transactions: { orderBy: { transactionDate: "asc" } },
      },
    });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    return asset;
  }

  async register(tx: Prisma.TransactionClient, companyId: string, userId: string, input: RegisterFixedAssetInput) {
    const category = await tx.assetCategory.findFirst({ where: { id: input.categoryId, companyId } });
    if (!category) throw new NotFoundException("Asset category not found");

    const cost = new Decimal(input.cost);
    if (cost.lte(0)) throw new BadRequestException("cost must be greater than zero");
    const salvageValue = new Decimal(input.salvageValue ?? 0);
    if (salvageValue.isNegative()) throw new BadRequestException("salvageValue cannot be negative");
    if (salvageValue.gte(cost)) throw new BadRequestException("salvageValue must be less than cost");

    const usefulLifeMonths = input.usefulLifeMonths ?? category.defaultUsefulLifeMonths;
    if (usefulLifeMonths <= 0) throw new BadRequestException("usefulLifeMonths must be greater than zero");
    const depreciationMethod = input.depreciationMethod ?? category.defaultDepreciationMethod;

    await this.accountsService.requirePostable(tx, companyId, input.fundingAccountId);

    const assetNumber = await this.numberingService.next(tx, companyId, null, "FIXED_ASSET", input.purchaseDate);

    // Create the asset row first (still un-costed in GL terms) so the
    // acquisition journal entry can carry its id as sourceId, exactly like
    // every other posted document in this system.
    const asset = await tx.fixedAsset.create({
      data: {
        companyId,
        assetNumber,
        name: input.name,
        nameAr: input.nameAr,
        categoryId: input.categoryId,
        purchaseDate: input.purchaseDate,
        usageStartDate: input.usageStartDate,
        cost: cost.toFixed(4),
        salvageValue: salvageValue.toFixed(4),
        usefulLifeMonths,
        depreciationMethod,
        status: FixedAssetStatus.ACTIVE,
      },
    });

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: input.purchaseDate,
      description: `Fixed Asset Acquisition ${assetNumber} — ${input.name}`,
      sourceType: JournalSourceType.FIXED_ASSET,
      sourceId: asset.id,
      lines: [
        { accountId: category.assetAccountId, debit: cost.toFixed(4) },
        { accountId: input.fundingAccountId, credit: cost.toFixed(4) },
      ],
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.fixedAsset.update({
      where: { id: asset.id },
      data: { postedJournalEntryId: posted.id },
      include: { category: true },
    });
  }

  /**
   * Removes an asset from the books: reverses its full cost and whatever
   * accumulated depreciation it has, records what (if anything) was
   * received for it, and posts the resulting gain or loss — the
   * difference between proceeds and net book value — to the shared
   * disposal gain/loss account (same "one account, either direction"
   * pattern as inventory adjustments).
   */
  async dispose(tx: Prisma.TransactionClient, companyId: string, userId: string, assetId: string, input: DisposeFixedAssetInput) {
    const asset = await tx.fixedAsset.findFirst({
      where: { id: assetId, companyId },
      include: { category: true, depreciationSchedules: true },
    });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    if (asset.status === FixedAssetStatus.DISPOSED) {
      throw new BadRequestException(`Asset ${asset.assetNumber} has already been disposed`);
    }

    const cost = new Decimal(asset.cost.toString());
    const accumulatedDepreciation = asset.depreciationSchedules.reduce(
      (sum, s) => sum.plus(new Decimal(s.amount.toString())),
      new Decimal(0),
    );
    const netBookValue = cost.minus(accumulatedDepreciation);

    const proceeds = new Decimal(input.proceeds ?? 0);
    if (proceeds.isNegative()) throw new BadRequestException("proceeds cannot be negative");
    if (proceeds.gt(0)) {
      if (!input.proceedsAccountId) throw new BadRequestException("proceedsAccountId is required when proceeds > 0");
      await this.accountsService.requirePostable(tx, companyId, input.proceedsAccountId);
    }

    const gainOrLoss = proceeds.minus(netBookValue); // positive = gain, negative = loss

    const lines: PostingLineInput[] = [{ accountId: asset.category.assetAccountId, credit: cost.toFixed(4) }];
    if (accumulatedDepreciation.gt(0)) {
      lines.push({ accountId: asset.category.accumulatedDepreciationAccountId, debit: accumulatedDepreciation.toFixed(4) });
    }
    if (proceeds.gt(0)) {
      lines.push({ accountId: input.proceedsAccountId!, debit: proceeds.toFixed(4) });
    }
    if (!gainOrLoss.isZero()) {
      const gainLossAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_ASSET_DISPOSAL_GAINLOSS");
      if (gainOrLoss.gt(0)) {
        lines.push({ accountId: gainLossAccountId, credit: gainOrLoss.toFixed(4) });
      } else {
        lines.push({ accountId: gainLossAccountId, debit: gainOrLoss.abs().toFixed(4) });
      }
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: input.disposalDate,
      description: `Fixed Asset Disposal ${asset.assetNumber} — ${asset.name}`,
      sourceType: JournalSourceType.FIXED_ASSET,
      sourceId: asset.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    await tx.assetTransaction.create({
      data: {
        assetId: asset.id,
        type: AssetTransactionType.DISPOSAL,
        transactionDate: input.disposalDate,
        amount: proceeds.toFixed(4),
        notes: input.notes,
        postedJournalEntryId: posted.id,
      },
    });

    return tx.fixedAsset.update({
      where: { id: asset.id },
      data: { status: FixedAssetStatus.DISPOSED },
      include: { category: true, transactions: true },
    });
  }
}
