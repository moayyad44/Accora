import { api } from "./client";
import type { Supplier } from "./parties";
import type { Item } from "./catalog";

export type PurchaseDocStatus = "DRAFT" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "POSTED" | "CANCELLED";

export interface PurchaseInvoiceLine {
  id: string;
  lineNumber: number;
  itemId: string;
  item?: Item;
  warehouseId: string | null;
  qty: string;
  unitCost: string;
  taxAmount: string;
  lineTotal: string;
}

export interface PurchaseInvoice {
  id: string;
  companyId: string;
  supplierId: string;
  supplier?: Supplier;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: PurchaseDocStatus;
  subtotal: string;
  taxTotal: string;
  total: string;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  createdAt: string;
  lines: PurchaseInvoiceLine[];
}

export interface CreatePurchaseInvoiceLineInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  unitCost: string;
}

export interface CreatePurchaseInvoiceInput {
  supplierId: string;
  invoiceDate: string;
  dueDate?: string;
  lines: CreatePurchaseInvoiceLineInput[];
}

export const purchasingApi = {
  invoices: {
    list: () => api.get<PurchaseInvoice[]>("/purchasing/invoices"),
    get: (id: string) => api.get<PurchaseInvoice>(`/purchasing/invoices/${id}`),
    create: (input: CreatePurchaseInvoiceInput) => api.post<PurchaseInvoice>("/purchasing/invoices", input),
    post: (id: string) => api.post<PurchaseInvoice>(`/purchasing/invoices/${id}/post`),
  },
};
