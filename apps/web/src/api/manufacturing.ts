import { api } from "./client";
import type { Item, UnitOfMeasure } from "./catalog";
import type { Warehouse } from "./inventory";

export interface WorkCenter {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  costPerHour: string;
  isActive: boolean;
}

export interface CreateWorkCenterInput {
  name: string;
  nameAr?: string;
  costPerHour?: string;
}

export interface BomLine {
  id: string;
  lineNumber: number;
  componentItemId: string;
  componentItem: Item;
  qty: string;
  unitId: string;
  unit: UnitOfMeasure;
  scrapPercent: string;
}

export interface Bom {
  id: string;
  companyId: string;
  itemId: string;
  item: Item;
  version: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  lines: BomLine[];
}

export interface CreateBomLineInput {
  componentItemId: string;
  qty: string;
  unitId: string;
  scrapPercent?: string;
}

export interface CreateBomInput {
  itemId: string;
  notes?: string;
  isActive?: boolean;
  lines: CreateBomLineInput[];
}

export interface StandardCost {
  id: string;
  itemId: string;
  materialCost: string;
  laborCost: string;
  overheadCost: string;
  effectiveDate: string;
}

export interface SetStandardCostInput {
  itemId: string;
  materialCost: string;
  laborCost: string;
  overheadCost: string;
  effectiveDate: string;
}

export type ProductionOrderStatus = "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface MaterialConsumption {
  id: string;
  itemId: string;
  item: Item;
  qty: string;
  unitCost: string;
  consumedAt: string;
}

export interface ProductionOutput {
  id: string;
  itemId: string;
  item: Item;
  qty: string;
  unitCost: string;
  producedAt: string;
}

export type CostVarianceType = "MATERIAL" | "LABOR" | "OVERHEAD";

export interface CostVariance {
  id: string;
  type: CostVarianceType;
  amount: string;
  notes: string | null;
}

export interface ProductionOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  bomId: string;
  bom: Bom;
  itemId: string;
  item: Item;
  warehouseId: string;
  warehouse: Warehouse;
  plannedQty: string;
  status: ProductionOrderStatus;
  startDate: string | null;
  endDate: string | null;
  postedJournalEntryId: string | null;
  createdAt: string;
  materialConsumptions: MaterialConsumption[];
  outputs: ProductionOutput[];
  costVariances: CostVariance[];
}

export interface CreateProductionOrderInput {
  itemId: string;
  plannedQty: string;
  warehouseId: string;
  startDate?: string;
  endDate?: string;
}

export interface CompleteProductionOrderInput {
  actualQty?: string;
  laborCost?: string;
  overheadCost?: string;
  outputSerialNumbers?: string[];
  outputBatch?: { batchNumber: string; expiryDate?: string; manufactureDate?: string };
}

export const manufacturingApi = {
  workCenters: {
    list: () => api.get<WorkCenter[]>("/manufacturing/work-centers"),
    create: (input: CreateWorkCenterInput) => api.post<WorkCenter>("/manufacturing/work-centers", input),
  },
  boms: {
    list: (itemId?: string) => api.get<Bom[]>(`/manufacturing/boms${itemId ? `?itemId=${itemId}` : ""}`),
    get: (id: string) => api.get<Bom>(`/manufacturing/boms/${id}`),
    create: (input: CreateBomInput) => api.post<Bom>("/manufacturing/boms", input),
  },
  standardCosts: {
    list: (itemId: string) => api.get<StandardCost[]>(`/manufacturing/standard-costs?itemId=${itemId}`),
    set: (input: SetStandardCostInput) => api.post<StandardCost>("/manufacturing/standard-costs", input),
  },
  productionOrders: {
    list: (status?: ProductionOrderStatus) =>
      api.get<ProductionOrder[]>(`/manufacturing/production-orders${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<ProductionOrder>(`/manufacturing/production-orders/${id}`),
    create: (input: CreateProductionOrderInput) => api.post<ProductionOrder>("/manufacturing/production-orders", input),
    release: (id: string) => api.post<ProductionOrder>(`/manufacturing/production-orders/${id}/release`, {}),
    complete: (id: string, input: CompleteProductionOrderInput) =>
      api.post<ProductionOrder>(`/manufacturing/production-orders/${id}/complete`, input),
  },
};
