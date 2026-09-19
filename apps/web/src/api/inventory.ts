import { api } from "./client";

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

/** Only what Sales/Purchasing need to pick a warehouse for now — the full
 * Inventory module (stock moves, transfers, counts, valuation) is a
 * separate, later pass. */
export const inventoryApi = {
  warehouses: {
    list: () => api.get<Warehouse[]>("/inventory/warehouses"),
    create: (input: CreateWarehouseInput) => api.post<Warehouse>("/inventory/warehouses", input),
  },
};
