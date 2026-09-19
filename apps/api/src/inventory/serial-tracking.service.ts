import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SerialStatus, StockMoveSourceType, StockMoveType } from "@prisma/client";
import Decimal from "decimal.js";

export interface ReceiveSerializedStockInput {
  itemId: string;
  warehouseId: string;
  serialNumbers: string[];
  unitCost: string;
  sourceType: StockMoveSourceType;
  sourceId?: string;
  moveDate?: Date;
}

export interface IssueSerializedStockInput {
  itemId: string;
  warehouseId: string;
  serialNumbers: string[];
  sourceType: StockMoveSourceType;
  sourceId?: string;
  moveDate?: Date;
}

/**
 * Serial-tracked items (docs/ARCHITECTURE.md §6, "Serial Number") don't go
 * through FIFO layers or weighted-average blending at all — each unit is
 * individually identified, so it's costed by specific identification: the
 * exact price it was received at, looked up from that unit's own receipt
 * StockMove. This is a recognized inventory costing method in its own
 * right, and the natural one once every unit has its own identity (an
 * imported laptop's serial doesn't get "averaged" with a different one).
 *
 * A one-to-one StockMove per serial keeps this compatible with everything
 * that already reads StockMove (item card, reports): a receipt of 3 serials
 * is 3 StockMove(IN) rows of qty=1 each, not one row of qty=3.
 */
@Injectable()
export class SerialTrackingService {
  async receive(tx: Prisma.TransactionClient, companyId: string, input: ReceiveSerializedStockInput) {
    const item = await tx.item.findFirst({ where: { id: input.itemId, companyId } });
    if (!item) throw new NotFoundException(`Item ${input.itemId} not found`);
    if (item.trackingType !== "SERIAL") {
      throw new BadRequestException(`Item ${item.sku} is not serial-tracked`);
    }
    const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException("Warehouse not found");
    if (input.serialNumbers.length === 0) throw new BadRequestException("At least one serial number is required");

    const unitCost = new Decimal(input.unitCost);
    const moveDate = input.moveDate ?? new Date();
    const moves = [];

    for (const serialNumber of input.serialNumbers) {
      const existing = await tx.serialNumber.findUnique({
        where: { itemId_serialNumber: { itemId: input.itemId, serialNumber } },
      });
      if (existing && existing.status === SerialStatus.IN_STOCK) {
        throw new BadRequestException(`Serial ${serialNumber} is already in stock — cannot receive it again`);
      }
      const serial = existing
        ? await tx.serialNumber.update({ where: { id: existing.id }, data: { status: SerialStatus.IN_STOCK } })
        : await tx.serialNumber.create({ data: { itemId: input.itemId, serialNumber, status: SerialStatus.IN_STOCK } });

      const move = await tx.stockMove.create({
        data: {
          companyId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          serialId: serial.id,
          moveType: StockMoveType.IN,
          qty: "1",
          unitCost: unitCost.toFixed(4),
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          moveDate,
        },
      });
      moves.push(move);
    }

    await this.applyBalanceDelta(tx, companyId, input.itemId, input.warehouseId, new Decimal(moves.length), unitCost);
    return moves;
  }

  async issue(tx: Prisma.TransactionClient, companyId: string, input: IssueSerializedStockInput) {
    if (input.serialNumbers.length === 0) throw new BadRequestException("At least one serial number is required");

    let totalCost = new Decimal(0);
    for (const serialNumber of input.serialNumbers) {
      const serial = await tx.serialNumber.findUnique({
        where: { itemId_serialNumber: { itemId: input.itemId, serialNumber } },
      });
      if (!serial || serial.status !== SerialStatus.IN_STOCK) {
        throw new BadRequestException(`Serial ${serialNumber} is not currently in stock`);
      }

      // Specific identification: cost this exact unit at what it was
      // actually received for, not a blended or oldest-layer estimate.
      const receipt = await tx.stockMove.findFirst({
        where: { companyId, itemId: input.itemId, serialId: serial.id, moveType: StockMoveType.IN },
        orderBy: { moveDate: "desc" },
      });
      if (!receipt) {
        throw new BadRequestException(`No receipt found for serial ${serialNumber} — stock ledger is inconsistent`);
      }
      const unitCost = new Decimal(receipt.unitCost.toString());
      totalCost = totalCost.plus(unitCost);

      await tx.stockMove.create({
        data: {
          companyId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          serialId: serial.id,
          moveType: StockMoveType.OUT,
          qty: "1",
          unitCost: unitCost.toFixed(4),
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          moveDate: input.moveDate ?? new Date(),
        },
      });
      await tx.serialNumber.update({ where: { id: serial.id }, data: { status: SerialStatus.SOLD } });
    }

    await tx.stockBalance.update({
      where: { itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId } },
      data: { qtyOnHand: { decrement: input.serialNumbers.length } },
    });

    return { totalCost: totalCost.toFixed(4), unitCost: totalCost.div(input.serialNumbers.length).toFixed(4) };
  }

  /** Serials currently in stock for an item (optionally scoped to a
   * warehouse) — what a sales screen would offer to pick from. */
  async listInStock(tx: Prisma.TransactionClient, companyId: string, itemId: string, warehouseId?: string) {
    const item = await tx.item.findFirst({ where: { id: itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");

    const inStockMoves = await tx.stockMove.findMany({
      where: {
        companyId,
        itemId,
        moveType: StockMoveType.IN,
        ...(warehouseId ? { warehouseId } : {}),
        serial: { status: SerialStatus.IN_STOCK },
      },
      include: { serial: true },
      orderBy: { moveDate: "asc" },
    });

    return inStockMoves.map((m) => ({
      serialNumber: m.serial!.serialNumber,
      receivedAt: m.moveDate.toISOString(),
      unitCost: m.unitCost.toFixed(4),
      warehouseId: m.warehouseId,
    }));
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
    const newAvg = newQty.isZero() ? oldAvg : oldQty.times(oldAvg).plus(qtyDelta.times(unitCost)).div(newQty);
    await tx.stockBalance.update({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      data: { qtyOnHand: newQty.toFixed(4), avgCost: newAvg.toFixed(4) },
    });
  }
}
