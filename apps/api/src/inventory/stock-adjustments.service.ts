import { BadRequestException, Injectable } from "@nestjs/common";
import { JournalSourceType, Prisma, StockMoveSourceType } from "@prisma/client";
import Decimal from "decimal.js";
import { InventoryService } from "./inventory.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";

export interface StockAdjustmentInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  direction: "INCREASE" | "DECREASE";
  /** Required for INCREASE (there's no purchase to derive a cost from —
   * e.g. stock found during a physical count). Ignored for DECREASE, which
   * costs itself from the item's existing valuation (FIFO layers /
   * weighted average), same as any other stock exit. */
  unitCost?: string;
  reason: string;
  adjustmentDate?: Date;
  /** Required for INCREASE when the item is batch-tracked. */
  batchNumber?: string;
  expiryDate?: Date;
}

/**
 * "تسويات مخزون" (docs/ARCHITECTURE.md §6): a manual correction to physical
 * stock — typically from a count finding more/less than the system expects
 * — that still respects the same rule as everything else in this system:
 * no stock quantity change without an accounting effect. Booked against
 * DEFAULT_INVENTORY_ADJUSTMENT, a single P&L account that nets small
 * shrinkage/overage; large or recurring variances are a sign to investigate
 * the process, not something this endpoint tries to categorize further.
 */
@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async adjust(tx: Prisma.TransactionClient, companyId: string, userId: string, input: StockAdjustmentInput) {
    const adjustmentDate = input.adjustmentDate ?? new Date();
    const inventoryAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_INVENTORY");
    const adjustmentAccountId = await this.accountMappingsService.require(
      tx,
      companyId,
      "DEFAULT_INVENTORY_ADJUSTMENT",
    );

    let amount: string;
    let lines: { accountId: string; debit?: string; credit?: string }[];

    if (input.direction === "INCREASE") {
      if (!input.unitCost) {
        throw new BadRequestException("unitCost is required to increase stock");
      }
      const move = await this.inventoryService.receiveStock(tx, companyId, {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        qty: input.qty,
        unitCost: input.unitCost,
        sourceType: StockMoveSourceType.MANUAL_ADJUSTMENT,
        moveDate: adjustmentDate,
        batch: input.batchNumber ? { batchNumber: input.batchNumber, expiryDate: input.expiryDate } : undefined,
      });
      amount = new Decimal(move.qty.toString()).times(move.unitCost.toString()).toFixed(4);
      lines = [
        { accountId: inventoryAccountId, debit: amount },
        { accountId: adjustmentAccountId, credit: amount },
      ];
    } else {
      const issued = await this.inventoryService.issueStock(tx, companyId, {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        qty: input.qty,
        sourceType: StockMoveSourceType.MANUAL_ADJUSTMENT,
        moveDate: adjustmentDate,
      });
      amount = issued.totalCost;
      lines = [
        { accountId: adjustmentAccountId, debit: amount },
        { accountId: inventoryAccountId, credit: amount },
      ];
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: adjustmentDate,
      description: `Stock adjustment (${input.direction}): ${input.reason}`,
      sourceType: JournalSourceType.INVENTORY_ADJUSTMENT,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return { journalEntryId: posted.id, amount, direction: input.direction };
  }
}
