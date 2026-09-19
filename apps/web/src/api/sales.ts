import { api } from "./client";
import type { Customer } from "./parties";
import type { Item } from "./catalog";

export type InvoiceKind = "CASH" | "CREDIT";
export type SalesDocStatus = "DRAFT" | "CONFIRMED" | "POSTED" | "CANCELLED";

export interface SalesInvoiceLine {
  id: string;
  lineNumber: number;
  itemId: string;
  item?: Item;
  warehouseId: string | null;
  qty: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface SalesInvoice {
  id: string;
  companyId: string;
  customerId: string;
  customer?: Customer;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  kind: InvoiceKind;
  status: SalesDocStatus;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  createdAt: string;
  lines: SalesInvoiceLine[];
}

export interface CreateSalesInvoiceLineInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  unitPrice: string;
  discountAmount?: string;
  description?: string;
}

export interface CreateSalesInvoiceInput {
  customerId: string;
  invoiceDate: string;
  dueDate?: string;
  kind?: InvoiceKind;
  lines: CreateSalesInvoiceLineInput[];
}

export const salesApi = {
  invoices: {
    list: () => api.get<SalesInvoice[]>("/sales/invoices"),
    get: (id: string) => api.get<SalesInvoice>(`/sales/invoices/${id}`),
    create: (input: CreateSalesInvoiceInput) => api.post<SalesInvoice>("/sales/invoices", input),
    post: (id: string) => api.post<SalesInvoice>(`/sales/invoices/${id}/post`),
  },
};
