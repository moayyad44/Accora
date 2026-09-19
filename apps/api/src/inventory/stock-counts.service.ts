import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, StockCountStatus, StockCountType, StockMoveSourceType } from "@prisma/client";
import Decimal from "decimal.js";
import { NumberingService } from "../accounting/numbering.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";
import { InventoryService } from "./inventory.service";

export interface CreateStockCountInput {
  warehouseId: string;
  type: StockCountType;
  countDate: Date;
  /** Restrict the count to specific items (a cycle count); omit for a full
   * physical count of everything on hand in the warehouse. */
  itemIds?: string[];
}

export interface SetCountedQtyInput {
  itemId: string;
  countedQty: string;
}

/**
 * "جرد دوري" / "جرد مفاجئ" (docs/ARCHITECTURE.md §6): snapshot what the
 * system believes is on hand, let a human record what's physically there,
 * then post the difference. Every variance still goes through
 * InventoryService.receiveStock/issueStock (so FIFO layers and balances
 * stay correct) and the whole count posts as ONE journal entry — a count
 * covering 50 items with 3 variances produces one GL entry with those 3
 * variances' worth of lines, not three separate entries.
 */
@Injectable()
export class StockCountsService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateStockCountInput) {
    const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException("Warehouse not found");

    const balances = await tx.stockBalance.findMany({
      where: {
        companyId,
        warehouseId: input.warehouseId,
        ...(input.itemIds ? { itemId: { in: input.itemIds } } : {}),
      },
    });

    const countNumber = await this.numberingService.next(tx, companyId, null, "STOCK_COUNT", input.countDate);

    return tx.stockCount.create({
      data: {
        companyId,
        warehouseId: input.warehouseId,
        countNumber,
        countDate: input.countDate,
        type: input.type,
        status: StockCountStatus.DRAFT,
        lines: {
          create: balances.map((b) => ({
            itemId: b.itemId,
            systemQty: b.qtyOnHand,
            countedQty: b.qtyOnHand, // defaults to "no variance"; updated via setCountedQty
            unitCost: b.avgCost,
          })),
        },
      },
      include: { lines: { include: { item: true } } },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, countId: string) {
    const count = await tx.stockCount.findFirst({
      where: { id: countId, companyId },
      include: { lines: { include: { item: true } }, warehouse: true },
    });
    if (!count) throw new NotFoundException("Stock count not found");
    return count;
  }

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.stockCount.findMany({ where: { companyId }, orderBy: { countDate: "desc" }, include: { warehouse: true } });
  }

  async setCountedQuantities(
    tx: Prisma.TransactionClient,
    companyId: string,
    countId: string,
    lines: SetCountedQtyInput[],
  ) {
    const count = await tx.stockCount.findFirst({ where: { id: countId, companyId } });
    if (!count) throw new NotFoundException("Stock count not found");
    if (count.status === StockCountStatus.POSTED) {
      throw new BadRequestException("This count has already been posted and can no longer be edited");
    }

    for (const line of lines) {
      const countLine = await tx.stockCountLine.findFirst({ where: { stockCountId: countId, itemId: line.itemId } });
      if (!countLine) throw new NotFoundException(`Item ${line.itemId} is not part of this count`);
      await tx.stockCountLine.update({
        where: { id: countLine.id },
        data: { countedQty: new Decimal(line.countedQty).toFixed(4) },
      });
    }

    return tx.stockCount.update({
      where: { id: countId },
      data: { status: StockCountStatus.IN_PROGRESS },
      include: { lines: { include: { item: true } } },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, countId: string) {
    const count = await tx.stockCount.findFirst({ where: { id: countId, companyId }, include: { lines: true } });
    if (!count) throw new NotFoundException("Stock count not found");
    if (count.status === StockCountStatus.POSTED) {
      throw new BadRequestException("This count has already been posted");
    }

    const variances = count.lines.filter((l) => !new Decimal(l.countedQty.toString()).equals(l.systemQty.toString()));

    if (variances.length === 0) {
      return tx.stockCount.update({ where: { id: countId }, data: { status: StockCountStatus.POSTED } });
    }

    const inventoryAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_INVENTORY");
    const adjustmentAccountId = await this.accountMappingsService.require(
      tx,
      companyId,
      "DEFAULT_INVENTORY_ADJUSTMENT",
    );

    const glLines: { accountId: string; debit?: string; credit?: string }[] = [];
    for (const line of variances) {
      const diff = new Decimal(line.countedQty.toString()).minus(line.systemQty.toString());
      if (diff.gt(0)) {
        const move = await this.inventoryService.receiveStock(tx, companyId, {
          itemId: line.itemId,
          warehouseId: count.warehouseId,
          qty: diff.toFixed(4),
          unitCost: line.unitCost.toString(),
          sourceType: StockMoveSourceType.STOCK_COUNT,
          sourceId: count.id,
          moveDate: count.countDate,
        });
        const amount = diff.times(move.unitCost.toString()).toFixed(4);
        glLines.push({ accountId: inventoryAccountId, debit: amount });
        glLines.push({ accountId: adjustmentAccountId, credit: amount });
      } else {
        const issued = await this.inventoryService.issueStock(tx, companyId, {
          itemId: line.itemId,
          warehouseId: count.warehouseId,
          qty: diff.abs().toFixed(4),
          sourceType: StockMoveSourceType.STOCK_COUNT,
          sourceId: count.id,
          moveDate: count.countDate,
        });
        glLines.push({ accountId: adjustmentAccountId, debit: issued.totalCost });
        glLines.push({ accountId: inventoryAccountId, credit: issued.totalCost });
      }
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: count.countDate,
      description: `Stock Count ${count.countNumber}`,
      sourceType: JournalSourceType.INVENTORY_ADJUSTMENT,
      sourceId: count.id,
      lines: glLines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.stockCount.update({
      where: { id: countId },
      data: { status: StockCountStatus.POSTED, postedJournalEntryId: posted.id },
      include: { lines: { include: { item: true } } },
    });
  }
}
