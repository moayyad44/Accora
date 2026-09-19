import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface SetStandardCostInput {
  itemId: string;
  materialCost: string;
  laborCost: string;
  overheadCost: string;
  effectiveDate: Date;
}

/**
 * "مقارنة التكلفة الفعلية بالمعيارية" (docs/ARCHITECTURE.md §7-8): a company
 * that wants standard costing sets a target cost per unit (material/labor/
 * overhead) for an item, effective from a given date. Completing a
 * production order for that item then compares what it actually cost
 * against whichever standard was effective on the order's date, recording
 * the difference as CostVariance rows — see ProductionOrdersService.
 * Entirely optional: an item with no StandardCost row simply gets no
 * variance analysis, nothing else changes.
 */
@Injectable()
export class StandardCostsService {
  async list(tx: Prisma.TransactionClient, companyId: string, itemId: string) {
    const item = await tx.item.findFirst({ where: { id: itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");
    return tx.standardCost.findMany({ where: { itemId }, orderBy: { effectiveDate: "desc" } });
  }

  async set(tx: Prisma.TransactionClient, companyId: string, input: SetStandardCostInput) {
    const item = await tx.item.findFirst({ where: { id: input.itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");
    for (const [k, v] of Object.entries({
      materialCost: input.materialCost,
      laborCost: input.laborCost,
      overheadCost: input.overheadCost,
    })) {
      if (Number(v) < 0) throw new BadRequestException(`${k} cannot be negative`);
    }

    return tx.standardCost.upsert({
      where: { itemId_effectiveDate: { itemId: input.itemId, effectiveDate: input.effectiveDate } },
      update: { materialCost: input.materialCost, laborCost: input.laborCost, overheadCost: input.overheadCost },
      create: {
        itemId: input.itemId,
        materialCost: input.materialCost,
        laborCost: input.laborCost,
        overheadCost: input.overheadCost,
        effectiveDate: input.effectiveDate,
      },
    });
  }

  /** The standard effective on a given date — the most recent one that
   * isn't in the future relative to it — or null if the item has none. */
  async getEffective(tx: Prisma.TransactionClient, itemId: string, asOfDate: Date) {
    return tx.standardCost.findFirst({
      where: { itemId, effectiveDate: { lte: asOfDate } },
      orderBy: { effectiveDate: "desc" },
    });
  }
}
