import { api } from "./client";
import type { Account, FiscalPeriod } from "./accounting";

export type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE";
export type FixedAssetStatus = "ACTIVE" | "DISPOSED" | "FULLY_DEPRECIATED";
export type AssetTransactionType = "DISPOSAL" | "TRANSFER" | "REVALUATION" | "MAINTENANCE";

export interface AssetCategory {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  defaultDepreciationMethod: DepreciationMethod;
  defaultUsefulLifeMonths: number;
  assetAccountId: string;
  assetAccount: Account;
  depreciationExpenseAccountId: string;
  depreciationExpenseAccount: Account;
  accumulatedDepreciationAccountId: string;
  accumulatedDepreciationAccount: Account;
}

export interface CreateAssetCategoryInput {
  name: string;
  nameAr?: string;
  defaultDepreciationMethod?: DepreciationMethod;
  defaultUsefulLifeMonths: number;
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
}

export interface DepreciationSchedule {
  id: string;
  assetId: string;
  periodId: string;
  period: FiscalPeriod;
  amount: string;
  accumulated: string;
  postedJournalEntryId: string | null;
  postedAt: string | null;
}

export interface AssetTransaction {
  id: string;
  assetId: string;
  type: AssetTransactionType;
  transactionDate: string;
  amount: string | null;
  notes: string | null;
  postedJournalEntryId: string | null;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  companyId: string;
  assetNumber: string;
  name: string;
  nameAr: string | null;
  categoryId: string;
  category: AssetCategory;
  purchaseDate: string;
  usageStartDate: string | null;
  cost: string;
  salvageValue: string;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  status: FixedAssetStatus;
  postedJournalEntryId: string | null;
  createdAt: string;
  depreciationSchedules: DepreciationSchedule[];
  transactions: AssetTransaction[];
}

export interface RegisterFixedAssetInput {
  categoryId: string;
  name: string;
  nameAr?: string;
  purchaseDate: string;
  usageStartDate?: string;
  cost: string;
  salvageValue?: string;
  usefulLifeMonths?: number;
  depreciationMethod?: DepreciationMethod;
  fundingAccountId: string;
}

export interface DisposeFixedAssetInput {
  disposalDate: string;
  proceeds?: string;
  proceedsAccountId?: string;
  notes?: string;
}

export interface RunDepreciationResult {
  periodId: string;
  journalEntryId: string | null;
  schedulesCreated: number;
  schedules: { assetId: string; amount: string; accumulated: string }[];
}

export const fixedAssetsApi = {
  categories: {
    list: () => api.get<AssetCategory[]>("/fixed-assets/categories"),
    get: (id: string) => api.get<AssetCategory>(`/fixed-assets/categories/${id}`),
    create: (input: CreateAssetCategoryInput) => api.post<AssetCategory>("/fixed-assets/categories", input),
  },
  assets: {
    list: (status?: FixedAssetStatus) => api.get<FixedAsset[]>(`/fixed-assets/assets${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<FixedAsset>(`/fixed-assets/assets/${id}`),
    register: (input: RegisterFixedAssetInput) => api.post<FixedAsset>("/fixed-assets/assets", input),
    dispose: (id: string, input: DisposeFixedAssetInput) => api.post<FixedAsset>(`/fixed-assets/assets/${id}/dispose`, input),
  },
  depreciationRuns: {
    run: (periodId: string) => api.post<RunDepreciationResult>("/fixed-assets/depreciation-runs", { periodId }),
  },
};
