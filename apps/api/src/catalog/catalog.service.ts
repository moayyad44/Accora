import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ItemTrackingType, ItemType, Prisma } from "@prisma/client";

export interface CreateUnitInput {
  code: string;
  name: string;
  nameAr?: string;
}

export interface CreateItemCategoryInput {
  name: string;
  nameAr?: string;
  parentId?: string | null;
}

export interface CreateItemInput {
  sku: string;
  name: string;
  nameAr?: string;
  categoryId?: string | null;
  baseUnitId: string;
  itemType?: ItemType;
  trackingType?: ItemTrackingType;
  barcode?: string;
}

/**
 * Minimal item/unit/category master data — just enough for Sales &
 * Purchasing (Phase 5) to reference real items on invoice lines. Warehouses,
 * stock quantities, FIFO/weighted-average valuation and physical stock
 * movements are Phase 6 (Inventory) and build on top of this same `Item`
 * table rather than replacing it.
 */
@Injectable()
export class CatalogService {
  async listUnits(tx: Prisma.TransactionClient, companyId: string) {
    return tx.unitOfMeasure.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  }

  async createUnit(tx: Prisma.TransactionClient, companyId: string, input: CreateUnitInput) {
    const existing = await tx.unitOfMeasure.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Unit code ${input.code} already exists`);
    return tx.unitOfMeasure.create({ data: { companyId, ...input } });
  }

  async listCategories(tx: Prisma.TransactionClient, companyId: string) {
    return tx.itemCategory.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async createCategory(tx: Prisma.TransactionClient, companyId: string, input: CreateItemCategoryInput) {
    if (input.parentId) {
      const parent = await tx.itemCategory.findFirst({ where: { id: input.parentId, companyId } });
      if (!parent) throw new NotFoundException("Parent category not found");
    }
    return tx.itemCategory.create({
      data: { companyId, name: input.name, nameAr: input.nameAr, parentId: input.parentId ?? null },
    });
  }

  async listItems(tx: Prisma.TransactionClient, companyId: string) {
    return tx.item.findMany({ where: { companyId }, orderBy: { sku: "asc" }, include: { category: true, baseUnit: true } });
  }

  async createItem(tx: Prisma.TransactionClient, companyId: string, input: CreateItemInput) {
    const existing = await tx.item.findUnique({ where: { companyId_sku: { companyId, sku: input.sku } } });
    if (existing) throw new BadRequestException(`Item SKU ${input.sku} already exists`);

    const unit = await tx.unitOfMeasure.findFirst({ where: { id: input.baseUnitId, companyId } });
    if (!unit) throw new BadRequestException("baseUnitId not found in this company");

    if (input.categoryId) {
      const category = await tx.itemCategory.findFirst({ where: { id: input.categoryId, companyId } });
      if (!category) throw new NotFoundException("Category not found");
    }

    return tx.item.create({
      data: {
        companyId,
        sku: input.sku,
        name: input.name,
        nameAr: input.nameAr,
        categoryId: input.categoryId ?? null,
        baseUnitId: input.baseUnitId,
        itemType: input.itemType ?? ItemType.TRADING,
        trackingType: input.trackingType ?? ItemTrackingType.NONE,
        barcode: input.barcode,
      },
    });
  }
}
