import { Injectable, NotFoundException } from "@nestjs/common";
import { DepreciationMethod, FixedAssetStatus, JournalSourceType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { JournalEntriesService, PostingLineInput } from "../accounting/journal-entries.service";

/**
 * Runs monthly depreciation for one fiscal period across every active
 * asset (docs/ARCHITECTURE.md §9). Idempotent: an asset that already has a
 * schedule row for this period is skipped, so calling run() twice for the
 * same period is harmless. Only the accounts each asset's category is
 * actually configured with get touched — this never invents an account,
 * mirroring the manufacturing module's per-item mapping resolution.
 */
@Injectable()
export class DepreciationService {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  async run(tx: Prisma.TransactionClient, companyId: string, userId: string, periodId: string) {
    const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId, fiscalYear: { companyId } } });
    if (!period) throw new NotFoundException("Fiscal period not found");

    const assets = await tx.fixedAsset.findMany({
      where: { companyId, status: FixedAssetStatus.ACTIVE },
      include: { category: true, depreciationSchedules: true },
    });

    const expenseByAccount = new Map<string, Decimal>();
    const accumDepByAccount = new Map<string, Decimal>();
    const created: { assetId: string; amount: string; accumulated: string }[] = [];
    const fullyDepreciatedAssetIds: string[] = [];

    for (const asset of assets) {
      const inUseFrom = asset.usageStartDate ?? asset.purchaseDate;
      if (inUseFrom > period.endDate) continue; // not yet placed in service this period
      if (asset.depreciationSchedules.some((s) => s.periodId === periodId)) continue; // already run

      const cost = new Decimal(asset.cost.toString());
      const salvageValue = new Decimal(asset.salvageValue.toString());
      const depreciableBase = cost.minus(salvageValue);
      const accumulatedSoFar = asset.depreciationSchedules.reduce(
        (sum, s) => sum.plus(new Decimal(s.amount.toString())),
        new Decimal(0),
      );
      const remainingBase = depreciableBase.minus(accumulatedSoFar);
      if (remainingBase.lte(0)) {
        fullyDepreciatedAssetIds.push(asset.id);
        continue;
      }

      let amount: Decimal;
      if (asset.depreciationMethod === DepreciationMethod.STRAIGHT_LINE) {
        amount = depreciableBase.div(asset.usefulLifeMonths);
      } else {
        // Double-declining balance: rate applied to net book value, not to
        // the depreciable base — the standard accelerated method.
        const rate = new Decimal(2).div(asset.usefulLifeMonths);
        const netBookValue = cost.minus(accumulatedSoFar);
        amount = netBookValue.times(rate);
      }
      if (amount.gt(remainingBase)) amount = remainingBase; // never depreciate past the salvage floor
      if (amount.lte(0)) continue;

      const newAccumulated = accumulatedSoFar.plus(amount);
      await tx.depreciationSchedule.create({
        data: { assetId: asset.id, periodId, amount: amount.toFixed(4), accumulated: newAccumulated.toFixed(4) },
      });
      created.push({ assetId: asset.id, amount: amount.toFixed(4), accumulated: newAccumulated.toFixed(4) });

      expenseByAccount.set(
        asset.category.depreciationExpenseAccountId,
        (expenseByAccount.get(asset.category.depreciationExpenseAccountId) ?? new Decimal(0)).plus(amount),
      );
      accumDepByAccount.set(
        asset.category.accumulatedDepreciationAccountId,
        (accumDepByAccount.get(asset.category.accumulatedDepreciationAccountId) ?? new Decimal(0)).plus(amount),
      );

      if (newAccumulated.gte(depreciableBase)) fullyDepreciatedAssetIds.push(asset.id);
    }

    let journalEntryId: string | null = null;
    if (created.length > 0) {
      const lines: PostingLineInput[] = [];
      for (const [accountId, amount] of expenseByAccount) lines.push({ accountId, debit: amount.toFixed(4) });
      for (const [accountId, amount] of accumDepByAccount) lines.push({ accountId, credit: amount.toFixed(4) });

      const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
        entryDate: period.endDate,
        description: `Depreciation run — ${period.name}`,
        sourceType: JournalSourceType.DEPRECIATION,
        lines,
      });
      const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);
      journalEntryId = posted.id;

      await tx.depreciationSchedule.updateMany({
        where: { periodId, assetId: { in: created.map((c) => c.assetId) } },
        data: { postedJournalEntryId: posted.id, postedAt: new Date() },
      });
    }

    if (fullyDepreciatedAssetIds.length > 0) {
      await tx.fixedAsset.updateMany({
        where: { id: { in: fullyDepreciatedAssetIds }, companyId },
        data: { status: FixedAssetStatus.FULLY_DEPRECIATED },
      });
    }

    return { periodId, journalEntryId, schedulesCreated: created.length, schedules: created };
  }
}
