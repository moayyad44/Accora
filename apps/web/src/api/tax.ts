import { api } from "./client";
import type { Account } from "./accounting";

export interface TaxRate {
  id: string;
  taxTypeId: string;
  name: string;
  rate: string;
  payableAccountId: string;
  payableAccount?: Account;
  effectiveDate: string;
  isActive: boolean;
}

export interface TaxType {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  rates: TaxRate[];
}

export interface CreateTaxTypeInput {
  name: string;
  nameAr?: string;
}

export interface CreateTaxRateInput {
  taxTypeId: string;
  name: string;
  rate: string;
  payableAccountId: string;
  effectiveDate: string;
}

export interface TaxGroupRate {
  taxGroupId: string;
  taxRateId: string;
  taxRate: TaxRate & { taxType: TaxType };
}

export interface TaxGroup {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
  rates: TaxGroupRate[];
}

export interface CreateTaxGroupInput {
  name: string;
  nameAr?: string;
  taxRateIds: string[];
}

export const taxApi = {
  types: {
    list: () => api.get<TaxType[]>("/tax/types"),
    get: (id: string) => api.get<TaxType>(`/tax/types/${id}`),
    create: (input: CreateTaxTypeInput) => api.post<TaxType>("/tax/types", input),
  },
  rates: {
    list: (taxTypeId: string) => api.get<TaxRate[]>(`/tax/rates?taxTypeId=${taxTypeId}`),
    create: (input: CreateTaxRateInput) => api.post<TaxRate>("/tax/rates", input),
  },
  groups: {
    list: () => api.get<TaxGroup[]>("/tax/groups"),
    get: (id: string) => api.get<TaxGroup>(`/tax/groups/${id}`),
    create: (input: CreateTaxGroupInput) => api.post<TaxGroup>("/tax/groups", input),
  },
};
