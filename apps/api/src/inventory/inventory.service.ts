import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryValuationMethod, Prisma, StockMoveSourceType, StockMoveType } from "@prisma/client";
import Decimal from "decimal.js";

export interface ReceiveStockInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  unitCost: string;
  sourceType: StockMoveSourceType;
  sourceId?: string;
  moveDate?: Date;
}

export interface IssueStockInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  sourceType: StockMoveSourceType;
  sourceId?: string;
  moveDate?: Date;
}

export interface IssueStockResult {
  totalCost: string;
  unitCost: string;
}

/**
 * The only code path allowed to create StockMove rows / change StockBalance
 * / consume FifoLayer rows — the inventory equivalent of the accounting
 * module's PostingEngine (see docs/ARCHITECTURE.md §5-6). Sales/Purchasing
 * call receiveStock()/issueStock() rather than touching these tables
 * directly, exactly like they call JournalEntriesService rather than
 * writing journal_entry_lines themselves.
 *
 * Valuation method is resolved per item: Item.valuationMethodOverride if
 * set, otherwise the company's CompanySetting.inventoryValuationMethod —
 * never hardcoded (docs/ARCHITECTURE.md §6, §31).
 */
@Injectable()
export class InventoryService {
  private async effectiveValuationMethod(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
  ): Promise<InventoryValuationMethod> {
    const item = await tx.item.findFirst({ where: { id: itemId, companyId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    if (item.valuationMethodOverride) return item.valuationMethodOverride;
    const settings = await tx.companySetting.findUniqueOrThrow({ where: { companyId } });
    return settings.inventoryValuationMethod;
  }

  async receiveStock(tx: Prisma.TransactionClient, companyId: string, input: ReceiveStockInput) {
    const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException("Warehouse not found");

    const qty = new Decimal(input.qty);
    const unitCost = new Decimal(input.unitCost);
    if (qty.lte(0)) throw new BadRequestException("Receive qty must be greater than zero");

    const method = await this.effectiveValuationMethod(tx, companyId, input.itemId);
    const moveDate = input.moveDate ?? new Date();

    const move = await tx.stockMove.create({
      data: {
        companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        moveType: this.moveTypeForReceive(input.sourceType),
        qty: qty.toFixed(4),
        unitCost: unitCost.toFixed(4),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        moveDate,
      },
    });

    await this.applyBalanceDelta(tx, companyId, input.itemId, input.warehouseId, qty, unitCost);

    if (method === InventoryValuationMethod.FIFO) {
      await tx.fifoLayer.create({
        data: {
          companyId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          receivedAt: moveDate,
          qtyRemaining: qty.toFixed(4),
          unitCost: unitCost.toFixed(4),
          sourceStockMoveId: move.id,
        },
      });
    }

    return move;
  }

  async issueStock(tx: Prisma.TransactionClient, companyId: string, input: IssueStockInput): Promise<IssueStockResult> {
    const qty = new Decimal(input.qty);
    if (qty.lte(0)) throw new BadRequestException("Issue qty must be greater than zero");

    const balance = await tx.stockBalance.findUnique({
      where: { itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId } },
    });
    const onHand = balance ? new Decimal(balance.qtyOnHand.toString()) : new Decimal(0);
    if (onHand.lt(qty)) {
      const item = await tx.item.findFirst({ where: { id: input.itemId, companyId } });
      throw new BadRequestException(
        `Insufficient stock for ${item?.sku ?? input.itemId}: available ${onHand.toFixed(4)}, requested ${qty.toFixed(4)}`,
      );
    }

    const method = await this.effectiveValuationMethod(tx, companyId, input.itemId);
    const moveDate = input.moveDate ?? new Date();

    let totalCost: Decimal;
    if (method === InventoryValuationMethod.FIFO) {
      totalCost = await this.consumeFifoLayers(tx, input.itemId, input.warehouseId, qty);
    } else {
      const avgCost = new Decimal(balance!.avgCost.toString());
      totalCost = qty.times(avgCost);
    }
    const unitCost = totalCost.div(qty);

    await tx.stockMove.create({
      data: {
        companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        moveType: this.moveTypeForIssue(input.sourceType),
        qty: qty.toFixed(4),
        unitCost: unitCost.toFixed(4),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        moveDate,
      },
    });

    // Weighted average stays the same when stock leaves at that same
    // average price — only qtyOnHand changes. FIFO doesn't use avgCost for
    // costing at all; it's left as-is, informational only.
    await tx.stockBalance.update({
      where: { itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId } },
      data: { qtyOnHand: onHand.minus(qty).toFixed(4) },
    });

    return { totalCost: totalCost.toFixed(4), unitCost: unitCost.toFixed(4) };
  }

  /** Moves stock between two warehouses of the same company at its current
   * cost basis (an internal relocation, not a purchase) — no GL effect,
   * since total inventory value is unchanged, only its location. */
  async transferStock(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    qty: string,
    moveDate?: Date,
  ) {
    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestException("Source and destination warehouse must differ");
    }
    const { totalCost, unitCost } = await this.issueStock(tx, companyId, {
      itemId,
      warehouseId: fromWarehouseId,
      qty,
      sourceType: StockMoveSourceType.TRANSFER,
      moveDate,
    });
    await this.receiveStock(tx, companyId, {
      itemId,
      warehouseId: toWarehouseId,
      qty,
      unitCost,
      sourceType: StockMoveSourceType.TRANSFER,
      moveDate,
    });
    return { totalCost, unitCost };
  }

  async getBalances(tx: Prisma.TransactionClient, companyId: string, warehouseId?: string) {
    return tx.stockBalance.findMany({
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      include: { item: true, warehouse: true },
      orderBy: { item: { sku: "asc" } },
    });
  }

  async getItemCard(tx: Prisma.TransactionClient, companyId: string, itemId: string, warehouseId?: string) {
    const item = await tx.item.findFirst({ where: { id: itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");

    const moves = await tx.stockMove.findMany({
      where: { companyId, itemId, ...(warehouseId ? { warehouseId } : {}) },
      orderBy: { moveDate: "asc" },
      include: { warehouse: true },
    });

    let running = new Decimal(0);
    const rows = moves.map((m) => {
      const qty = new Decimal(m.qty.toString());
      running = m.moveType === StockMoveType.IN || m.moveType === StockMoveType.TRANSFER_IN || m.moveType === StockMoveType.ADJUSTMENT_IN
        ? running.plus(qty)
        : running.minus(qty);
      return {
        moveDate: m.moveDate.toISOString(),
        warehouse: m.warehouse.code,
        moveType: m.moveType,
        qty: qty.toFixed(4),
        unitCost: m.unitCost.toString(),
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        runningQty: running.toFixed(4),
      };
    });

    return { item: { id: item.id, sku: item.sku, name: item.name }, rows };
  }

  private moveTypeForReceive(sourceType: StockMoveSourceType): StockMoveType {
    if (sourceType === StockMoveSourceType.TRANSFER) return StockMoveType.TRANSFER_IN;
    if (sourceType === StockMoveSourceType.MANUAL_ADJUSTMENT) return StockMoveType.ADJUSTMENT_IN;
    return StockMoveType.IN;
  }

  private moveTypeForIssue(sourceType: StockMoveSourceType): StockMoveType {
    if (sourceType === StockMoveSourceType.TRANSFER) return StockMoveType.TRANSFER_OUT;
    if (sourceType === StockMoveSourceType.MANUAL_ADJUSTMENT) return StockMoveType.ADJUSTMENT_OUT;
    return StockMoveType.OUT;
  }

  private async applyBalanceDelta(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    warehouseId: string,
    qtyDelta: Decimal,
    unitCost: Decimal,
  ) {
    const existing = await tx.stockBalance.findUnique({ where: { itemId_warehouseId: { itemId, warehouseId } } });
    if (!existing) {
      await tx.stockBalance.create({
        data: { companyId, itemId, warehouseId, qtyOnHand: qtyDelta.toFixed(4), avgCost: unitCost.toFixed(4) },
      });
      return;
    }
    const oldQty = new Decimal(existing.qtyOnHand.toString());
    const oldAvg = new Decimal(existing.avgCost.toString());
    const newQty = oldQty.plus(qtyDelta);
    // Moving-average recompute: (old value + new value) / new qty.
    const newAvg = newQty.isZero() ? oldAvg : oldQty.times(oldAvg).plus(qtyDelta.times(unitCost)).div(newQty);
    await tx.stockBalance.update({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      data: { qtyOnHand: newQty.toFixed(4), avgCost: newAvg.toFixed(4) },
    });
  }

  /** Consumes the oldest layers first until `qty` is satisfied, returning
   * the total actual cost of what was consumed (the whole point of FIFO:
   * each unit is costed at the price it was actually bought for). */
  private async consumeFifoLayers(
    tx: Prisma.TransactionClient,
    itemId: string,
    warehouseId: string,
    qty: Decimal,
  ): Promise<Decimal> {
    const layers = await tx.fifoLayer.findMany({
      where: { itemId, warehouseId, qtyRemaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
    });

    let remaining = qty;
    let totalCost = new Decimal(0);
    for (const layer of layers) {
      if (remaining.lte(0)) break;
      const layerQty = new Decimal(layer.qtyRemaining.toString());
      const layerUnitCost = new Decimal(layer.unitCost.toString());
      const consume = Decimal.min(layerQty, remaining);

      totalCost = totalCost.plus(consume.times(layerUnitCost));
      remaining = remaining.minus(consume);

      await tx.fifoLayer.update({
        where: { id: layer.id },
        data: { qtyRemaining: layerQty.minus(consume).toFixed(4) },
      });
    }

    if (remaining.gt(0)) {
      // Should be unreachable — issueStock() already checked StockBalance
      // covers `qty` before calling this. If FIFO layers and StockBalance
      // ever drift apart, fail loudly rather than under-cost silently.
      throw new BadRequestException(
        `FIFO layers do not cover the requested quantity (short by ${remaining.toFixed(4)}) — stock ledger is inconsistent`,
      );
    }

    return totalCost;
  }
}
