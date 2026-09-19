import { api } from "./client";

export interface Customer {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr: string | null;
  groupId: string | null;
  creditLimit: string;
  paymentTermDays: number;
  arAccountId: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCustomerInput {
  code: string;
  name: string;
  nameAr?: string;
  creditLimit?: string;
  paymentTermDays?: number;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr: string | null;
  paymentTermDays: number;
  apAccountId: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  nameAr?: string;
  paymentTermDays?: number;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export const partiesApi = {
  customers: {
    list: () => api.get<Customer[]>("/customers"),
    create: (input: CreateCustomerInput) => api.post<Customer>("/customers", input),
  },
  suppliers: {
    list: () => api.get<Supplier[]>("/suppliers"),
    create: (input: CreateSupplierInput) => api.post<Supplier>("/suppliers", input),
  },
};
