import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ItemType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export interface BomLineInput {
  componentItemId: string;
  qty: string;
  unitId: string;
  scrapPercent?: string;
}

export interface CreateBomInput {
  itemId: string;
  notes?: string;
  /** Defaults to true — a newly created BOM becomes the item's active
   * recipe, deactivating any previous one, exactly like a company
   * revising how a product is built and wanting that to take effect
   * immediately. Pass false to draft a future revision without activating it. */
  isActive?: boolean;
  lines: BomLineInput[];
}

/**
 * A BOM's component can itself be a SEMI_FINISHED item with its own active
 * BOM (multi-level BOM, docs/ARCHITECTURE.md §7) — nothing special is
 * needed here for that to work, since a production order for the parent
 * simply consumes the semi-finished component at whatever stock/cost it
 * currently has (itself the product of an earlier, separate production
 * order). Automatic multi-level explosion (planning "how much raw material
 * do I ultimately need for 100 chairs") is not built yet — see
 * docs/MANUFACTURING.md.
 */
@Injectable()
export class BomsService {
  async list(tx: Prisma.TransactionClient, companyId: string, itemId?: string) {
    return tx.bom.findMany({
      where: { companyId, ...(itemId ? { itemId } : {}) },
      include: { item: true, lines: { include: { componentItem: true, unit: true } } },
      orderBy: [{ itemId: "asc" }, { version: "desc" }],
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, bomId: string) {
    const bom = await tx.bom.findFirst({
      where: { id: bomId, companyId },
      include: { item: true, lines: { include: { componentItem: true, unit: true } } },
    });
    if (!bom) throw new NotFoundException("BOM not found");
    return bom;
  }

  /** The recipe ProductionOrdersService actually uses when none is
   * specified explicitly. */
  async getActiveBom(tx: Prisma.TransactionClient, companyId: string, itemId: string) {
    const bom = await tx.bom.findFirst({
      where: { companyId, itemId, isActive: true },
      include: { lines: { include: { componentItem: true, unit: true } } },
      orderBy: { version: "desc" },
    });
    if (!bom) throw new NotFoundException(`No active BOM found for this item — create one first`);
    return bom;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateBomInput) {
    const item = await tx.item.findFirst({ where: { id: input.itemId, companyId } });
    if (!item) throw new NotFoundException("Item not found");
    if (item.itemType !== ItemType.SEMI_FINISHED && item.itemType !== ItemType.FINISHED_GOOD) {
      throw new BadRequestException(
        `A BOM produces a manufactured item — ${item.sku} is itemType ${item.itemType}, expected SEMI_FINISHED or FINISHED_GOOD`,
      );
    }
    if (input.lines.length === 0) throw new BadRequestException("BOM needs at least one component line");

    for (const line of input.lines) {
      if (line.componentItemId === input.itemId) {
        throw new BadRequestException("A BOM cannot use its own output item as a component");
      }
      const component = await tx.item.findFirst({ where: { id: line.componentItemId, companyId } });
      if (!component) throw new NotFoundException(`Component item ${line.componentItemId} not found`);
      const unit = await tx.unitOfMeasure.findFirst({ where: { id: line.unitId, companyId } });
      if (!unit) throw new NotFoundException(`Unit ${line.unitId} not found`);
      if (new Decimal(line.qty).lte(0)) throw new BadRequestException("Component qty must be greater than zero");
    }

    const latest = await tx.bom.findFirst({ where: { companyId, itemId: input.itemId }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    const isActive = input.isActive ?? true;

    if (isActive) {
      await tx.bom.updateMany({ where: { companyId, itemId: input.itemId, isActive: true }, data: { isActive: false } });
    }

    return tx.bom.create({
      data: {
        companyId,
        itemId: input.itemId,
        version,
        isActive,
        notes: input.notes,
        lines: {
          create: input.lines.map((l, index) => ({
            lineNumber: index + 1,
            componentItemId: l.componentItemId,
            qty: l.qty,
            unitId: l.unitId,
            scrapPercent: l.scrapPercent ?? "0",
          })),
        },
      },
      include: { lines: { include: { componentItem: true, unit: true } } },
    });
  }
}
