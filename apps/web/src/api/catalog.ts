import { api } from "./client";

export interface UnitOfMeasure {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr: string | null;
}

export interface ItemCategory {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
}

export type ItemType = "RAW_MATERIAL" | "SEMI_FINISHED" | "FINISHED_GOOD" | "TRADING" | "SERVICE";
export type ItemTrackingType = "NONE" | "BATCH" | "SERIAL";

export interface Item {
  id: string;
  companyId: string;
  sku: string;
  barcode: string | null;
  name: string;
  nameAr: string | null;
  categoryId: string | null;
  baseUnitId: string;
  itemType: ItemType;
  trackingType: ItemTrackingType;
  isActive: boolean;
}

export interface CreateItemInput {
  sku: string;
  name: string;
  nameAr?: string;
  categoryId?: string;
  baseUnitId: string;
  itemType?: ItemType;
  trackingType?: ItemTrackingType;
  barcode?: string;
}

export const catalogApi = {
  units: {
    list: () => api.get<UnitOfMeasure[]>("/catalog/units"),
    create: (input: { code: string; name: string; nameAr?: string }) =>
      api.post<UnitOfMeasure>("/catalog/units", input),
  },
  categories: {
    list: () => api.get<ItemCategory[]>("/catalog/categories"),
    create: (input: { name: string; nameAr?: string; parentId?: string }) =>
      api.post<ItemCategory>("/catalog/categories", input),
  },
  items: {
    list: () => api.get<Item[]>("/catalog/items"),
    create: (input: CreateItemInput) => api.post<Item>("/catalog/items", input),
  },
};
