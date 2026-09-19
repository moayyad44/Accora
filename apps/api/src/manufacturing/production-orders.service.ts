import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CostVarianceType,
  ItemTrackingType,
  JournalSourceType,
  Prisma,
  ProductionOrderStatus,
  StockMoveSourceType,
} from "@prisma/client";
import Decimal from "decimal.js";
import { BomsService } from "./boms.service";
import { StandardCostsService } from "./standard-costs.service";
import { InventoryService } from "../inventory/inventory.service";
import { SerialTrackingService } from "../inventory/serial-tracking.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService, PostingLineInput } from "../accounting/journal-entries.service";
import { NumberingService } from "../accounting/numbering.service";

export interface CreateProductionOrderInput {
  itemId: string;
  plannedQty: string;
  warehouseId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ReleaseProductionOrderInput {
  /** Component itemId -> exact serial numbers to consume, required only
   * for BOM components that are serial-tracked. */
  componentSerials?: Record<string, string[]>;
}

export interface CompleteProductionOrderInput {
  actualQty?: string;
  laborCost?: string;
  overheadCost?: string;
  outputSerialNumbers?: string[];
  outputBatch?: { batchNumber: string; expiryDate?: Date; manufactureDate?: Date };
}

/**
 * The production order lifecycle (docs/ARCHITECTURE.md §7): DRAFT (planned)
 * -> release() consumes raw materials per the active BOM and moves to
 * IN_PROGRESS -> complete() receives the finished/semi-finished output at
 * its computed actual cost, posts the one journal entry that is a
 * production order's entire accounting effect, and moves to COMPLETED.
 *
 * Like Sales/Purchasing, this module never writes StockMove/StockBalance or
 * journal_entry_lines directly — it calls InventoryService/
 * SerialTrackingService and JournalEntriesService exactly as they do.
 */
@Injectable()
export class ProductionOrdersService {
  constructor(
    private readonly bomsService: BomsService,
    private readonly standardCostsService: StandardCostsService,
    private readonly inventoryService: InventoryService,
    private readonly serialTrackingService: SerialTrackingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly numberingService: NumberingService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string, status?: ProductionOrderStatus) {
    return tx.productionOrder.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { item: true, warehouse: true, bom: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, orderId: string) {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        item: true,
        warehouse: true,
        bom: { include: { lines: { include: { componentItem: true, unit: true } } } },
        materialConsumptions: { include: { item: true } },
        outputs: { include: { item: true } },
        costVariances: true,
      },
    });
    if (!order) throw new NotFoundException("Production order not found");
    return order;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateProductionOrderInput) {
    const item = await tx.item.findFirst({ where: { id: input.itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");
    const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException("Warehouse not found");

    const plannedQty = new Decimal(input.plannedQty);
    if (plannedQty.lte(0)) throw new BadRequestException("Planned qty must be greater than zero");

    // Resolve the recipe now, at planning time — releasing later consumes
    // exactly what this BOM said, not whatever happens to be active then.
    const bom = await this.bomsService.getActiveBom(tx, companyId, input.itemId);

    const orderNumber = await this.numberingService.next(
      tx,
      companyId,
      null,
      "PRODUCTION_ORDER",
      input.startDate ?? new Date(),
    );

    return tx.productionOrder.create({
      data: {
        companyId,
        orderNumber,
        bomId: bom.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        plannedQty: plannedQty.toFixed(4),
        status: ProductionOrderStatus.DRAFT,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      include: { bom: { include: { lines: true } }, item: true, warehouse: true },
    });
  }

  async release(
    tx: Prisma.TransactionClient,
    companyId: string,
    orderId: string,
    input: ReleaseProductionOrderInput = {},
  ) {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId },
      include: { bom: { include: { lines: { include: { componentItem: true } } } } },
    });
    if (!order) throw new NotFoundException("Production order not found");
    if (order.status !== ProductionOrderStatus.DRAFT) {
      throw new BadRequestException(`Order ${order.orderNumber} is already ${order.status.toLowerCase()}`);
    }

    const plannedQty = new Decimal(order.plannedQty.toString());

    for (const line of order.bom.lines) {
      const scrapMultiplier = new Decimal(1).plus(new Decimal(line.scrapPercent.toString()).div(100));
      const qtyNeeded = new Decimal(line.qty.toString()).times(plannedQty).times(scrapMultiplier);

      let unitCost: string;
      if (line.componentItem.trackingType === ItemTrackingType.SERIAL) {
        const serials = input.componentSerials?.[line.componentItemId];
        if (!serials || serials.length === 0) {
          throw new BadRequestException(
            `Component ${line.componentItem.sku} is serial-tracked — provide componentSerials["${line.componentItemId}"]`,
          );
        }
        const issued = await this.serialTrackingService.issue(tx, companyId, {
          itemId: line.componentItemId,
          warehouseId: order.warehouseId,
          serialNumbers: serials,
          sourceType: StockMoveSourceType.PRODUCTION_CONSUMPTION,
          sourceId: order.id,
        });
        unitCost = issued.unitCost;
      } else {
        const issued = await this.inventoryService.issueStock(tx, companyId, {
          itemId: line.componentItemId,
          warehouseId: order.warehouseId,
          qty: qtyNeeded.toFixed(4),
          sourceType: StockMoveSourceType.PRODUCTION_CONSUMPTION,
          sourceId: order.id,
        });
        unitCost = issued.unitCost;
      }

      await tx.materialConsumption.create({
        data: {
          productionOrderId: order.id,
          itemId: line.componentItemId,
          qty: qtyNeeded.toFixed(4),
          unitCost,
        },
      });
    }

    return tx.productionOrder.update({
      where: { id: order.id },
      data: { status: ProductionOrderStatus.IN_PROGRESS },
      include: { bom: true, item: true, materialConsumptions: { include: { item: true } } },
    });
  }

  async complete(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    orderId: string,
    input: CompleteProductionOrderInput = {},
  ) {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId },
      include: { item: true, materialConsumptions: { include: { item: true } } },
    });
    if (!order) throw new NotFoundException("Production order not found");
    if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Order ${order.orderNumber} is not in progress (currently ${order.status.toLowerCase()})`,
      );
    }

    const actualQty = input.actualQty ? new Decimal(input.actualQty) : new Decimal(order.plannedQty.toString());
    if (actualQty.lte(0)) throw new BadRequestException("Actual qty must be greater than zero");

    const laborCost = new Decimal(input.laborCost ?? 0);
    const overheadCost = new Decimal(input.overheadCost ?? 0);
    if (laborCost.isNegative() || overheadCost.isNegative()) {
      throw new BadRequestException("Labor/overhead cost cannot be negative");
    }

    // What was actually consumed at release, grouped by which inventory
    // account each component's itemType belongs to (usually all
    // DEFAULT_RAW_MATERIALS_INVENTORY, but a component can itself be a
    // semi-finished item sitting in DEFAULT_WIP_INVENTORY).
    const materialCostByMappingKey = new Map<string, Decimal>();
    let totalMaterialCost = new Decimal(0);
    for (const mc of order.materialConsumptions) {
      const lineCost = new Decimal(mc.qty.toString()).times(new Decimal(mc.unitCost.toString()));
      totalMaterialCost = totalMaterialCost.plus(lineCost);
      const key = this.accountMappingsService.inventoryMappingKeyForItemType(mc.item.itemType);
      materialCostByMappingKey.set(key, (materialCostByMappingKey.get(key) ?? new Decimal(0)).plus(lineCost));
    }

    const totalCost = totalMaterialCost.plus(laborCost).plus(overheadCost);
    const outputUnitCost = totalCost.div(actualQty);

    if (order.item.trackingType === ItemTrackingType.SERIAL) {
      if (!input.outputSerialNumbers || input.outputSerialNumbers.length !== actualQty.toNumber()) {
        throw new BadRequestException(
          `Item ${order.item.sku} is serial-tracked — provide exactly ${actualQty.toFixed(0)} outputSerialNumbers`,
        );
      }
      await this.serialTrackingService.receive(tx, companyId, {
        itemId: order.itemId,
        warehouseId: order.warehouseId,
        serialNumbers: input.outputSerialNumbers,
        unitCost: outputUnitCost.toFixed(4),
        sourceType: StockMoveSourceType.PRODUCTION_OUTPUT,
        sourceId: order.id,
      });
    } else {
      await this.inventoryService.receiveStock(tx, companyId, {
        itemId: order.itemId,
        warehouseId: order.warehouseId,
        qty: actualQty.toFixed(4),
        unitCost: outputUnitCost.toFixed(4),
        sourceType: StockMoveSourceType.PRODUCTION_OUTPUT,
        sourceId: order.id,
        batch: input.outputBatch,
      });
    }

    await tx.productionOutput.create({
      data: {
        productionOrderId: order.id,
        itemId: order.itemId,
        qty: actualQty.toFixed(4),
        unitCost: outputUnitCost.toFixed(4),
      },
    });

    // DR the output item's own inventory account (raw material / WIP /
    // finished goods, resolved the same way sales/purchasing resolve
    // theirs) for the whole cost; CR every account that cost came out of.
    const outputMappingKey = this.accountMappingsService.inventoryMappingKeyForItemType(order.item.itemType);
    const outputAccountId = await this.accountMappingsService.require(tx, companyId, outputMappingKey);

    const lines: PostingLineInput[] = [{ accountId: outputAccountId, debit: totalCost.toFixed(4) }];
    for (const [key, amount] of materialCostByMappingKey) {
      if (amount.lte(0)) continue;
      const accountId = await this.accountMappingsService.require(tx, companyId, key);
      lines.push({ accountId, credit: amount.toFixed(4) });
    }
    if (laborCost.gt(0)) {
      const accountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_DIRECT_LABOR");
      lines.push({ accountId, credit: laborCost.toFixed(4) });
    }
    if (overheadCost.gt(0)) {
      const accountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_MANUFACTURING_OVERHEAD");
      lines.push({ accountId, credit: overheadCost.toFixed(4) });
    }

    const entryDate = new Date();
    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate,
      description: `Production Order ${order.orderNumber}`,
      sourceType: JournalSourceType.PRODUCTION_ORDER,
      sourceId: order.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    // Optional: if the company set a standard cost for this item, record
    // how far actual cost diverged from it. An item with no StandardCost
    // simply gets no variance rows — nothing else about completion changes.
    const standard = await this.standardCostsService.getEffective(tx, order.itemId, entryDate);
    if (standard) {
      const standardMaterial = new Decimal(standard.materialCost.toString()).times(actualQty);
      const standardLabor = new Decimal(standard.laborCost.toString()).times(actualQty);
      const standardOverhead = new Decimal(standard.overheadCost.toString()).times(actualQty);

      await tx.costVariance.createMany({
        data: [
          {
            productionOrderId: order.id,
            type: CostVarianceType.MATERIAL,
            amount: totalMaterialCost.minus(standardMaterial).toFixed(4),
          },
          {
            productionOrderId: order.id,
            type: CostVarianceType.LABOR,
            amount: laborCost.minus(standardLabor).toFixed(4),
          },
          {
            productionOrderId: order.id,
            type: CostVarianceType.OVERHEAD,
            amount: overheadCost.minus(standardOverhead).toFixed(4),
          },
        ],
      });
    }

    return tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: ProductionOrderStatus.COMPLETED,
        postedJournalEntryId: posted.id,
        endDate: order.endDate ?? entryDate,
      },
      include: {
        item: true,
        warehouse: true,
        materialConsumptions: { include: { item: true } },
        outputs: { include: { item: true } },
        costVariances: true,
      },
    });
  }
}
