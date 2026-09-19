import { api } from "./client";
import type { Item } from "./catalog";

export interface Warehouse {
  id: string;
  companyId: string;
  branchId: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  nameAr?: string;
}

export interface StockBalance {
  itemId: string;
  item: Item;
  warehouseId: string;
  warehouse: Warehouse;
  qtyOnHand: string;
  avgCost: string;
  updatedAt: string;
}

export type StockMoveType = "IN" | "OUT" | "TRANSFER_OUT" | "TRANSFER_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
export type StockMoveSourceType =
  | "SALES_INVOICE"
  | "SALES_RETURN"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN"
  | "GOODS_RECEIPT"
  | "TRANSFER"
  | "STOCK_COUNT"
  | "PRODUCTION_CONSUMPTION"
  | "PRODUCTION_OUTPUT"
  | "MANUAL_ADJUSTMENT";

export interface ItemCardRow {
  moveDate: string;
  warehouse: string;
  moveType: StockMoveType;
  qty: string;
  unitCost: string;
  sourceType: StockMoveSourceType;
  sourceId: string | null;
  runningQty: string;
}
export interface ItemCard {
  item: { id: string; sku: string; name: string };
  rows: ItemCardRow[];
}

export interface TransferStockInput {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: string;
}

export interface AdjustStockInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  direction: "INCREASE" | "DECREASE";
  unitCost?: string;
  reason: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface BatchInfo {
  id: string;
  batchNumber: string;
  manufactureDate: string | null;
  expiryDate: string | null;
  remainingQty: string;
}

export interface ExpiringBatch {
  batchNumber: string;
  expiryDate: string | null;
  item: { id: string; sku: string; name: string };
  remainingQty: string;
}

export type StockCountType = "PERIODIC" | "SURPRISE";
export type StockCountStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "POSTED";

export interface StockCountLine {
  id: string;
  itemId: string;
  item: Item;
  systemQty: string;
  countedQty: string;
  unitCost: string;
}

export interface StockCount {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouse: Warehouse;
  countNumber: string;
  countDate: string;
  type: StockCountType;
  status: StockCountStatus;
  postedJournalEntryId: string | null;
  lines: StockCountLine[];
}

export interface CreateStockCountInput {
  warehouseId: string;
  type: StockCountType;
  countDate: string;
  itemIds?: string[];
}

export const inventoryApi = {
  warehouses: {
    list: () => api.get<Warehouse[]>("/inventory/warehouses"),
    create: (input: CreateWarehouseInput) => api.post<Warehouse>("/inventory/warehouses", input),
  },
  stockBalances: {
    list: (warehouseId?: string) =>
      api.get<StockBalance[]>(`/inventory/stock-balances${warehouseId ? `?warehouseId=${warehouseId}` : ""}`),
  },
  itemCard: (itemId: string, warehouseId?: string) =>
    api.get<ItemCard>(`/inventory/items/${itemId}/card${warehouseId ? `?warehouseId=${warehouseId}` : ""}`),
  transfers: {
    create: (input: TransferStockInput) => api.post<unknown>("/inventory/transfers", input),
  },
  adjustments: {
    create: (input: AdjustStockInput) => api.post<unknown>("/inventory/adjustments", input),
  },
  batches: {
    forItem: (itemId: string) => api.get<BatchInfo[]>(`/inventory/items/${itemId}/batches`),
    expiring: (withinDays?: number) =>
      api.get<ExpiringBatch[]>(`/inventory/expiring-batches${withinDays ? `?withinDays=${withinDays}` : ""}`),
  },
  stockCounts: {
    list: () => api.get<StockCount[]>("/inventory/stock-counts"),
    get: (id: string) => api.get<StockCount>(`/inventory/stock-counts/${id}`),
    create: (input: CreateStockCountInput) => api.post<StockCount>("/inventory/stock-counts", input),
    setCountedQuantities: (id: string, lines: { itemId: string; countedQty: string }[]) =>
      api.patch<StockCount>(`/inventory/stock-counts/${id}/counted-quantities`, { lines }),
    post: (id: string) => api.post<StockCount>(`/inventory/stock-counts/${id}/post`),
  },
};
