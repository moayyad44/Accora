import { api } from "./client";
import type { Account } from "./accounting";
import type { Customer, Supplier } from "./parties";

export type CashBankAccountType = "CASH" | "BANK";
export type VoucherPartyType = "CUSTOMER" | "SUPPLIER" | "OTHER";
export type VoucherStatus = "DRAFT" | "POSTED";

export interface CashBankAccount {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  type: CashBankAccountType;
  accountId: string;
  account: Account;
  bankName: string | null;
  accountNumber: string | null;
  iban: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCashBankAccountInput {
  name: string;
  nameAr?: string;
  type: CashBankAccountType;
  accountId: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
}

export interface ReceiptVoucher {
  id: string;
  companyId: string;
  branchId: string | null;
  voucherNumber: string;
  voucherDate: string;
  cashBankAccountId: string;
  cashBankAccount: CashBankAccount;
  partyType: VoucherPartyType;
  customerId: string | null;
  customer: Customer | null;
  supplierId: string | null;
  supplier: Supplier | null;
  otherAccountId: string | null;
  otherAccount: Account | null;
  salesInvoiceId: string | null;
  amount: string;
  description: string | null;
  status: VoucherStatus;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

export interface CreateReceiptVoucherInput {
  cashBankAccountId: string;
  voucherDate: string;
  partyType: VoucherPartyType;
  customerId?: string;
  supplierId?: string;
  otherAccountId?: string;
  amount: string;
  description?: string;
}

export interface PaymentVoucher {
  id: string;
  companyId: string;
  branchId: string | null;
  voucherNumber: string;
  voucherDate: string;
  cashBankAccountId: string;
  cashBankAccount: CashBankAccount;
  partyType: VoucherPartyType;
  customerId: string | null;
  customer: Customer | null;
  supplierId: string | null;
  supplier: Supplier | null;
  otherAccountId: string | null;
  otherAccount: Account | null;
  purchaseInvoiceId: string | null;
  amount: string;
  description: string | null;
  status: VoucherStatus;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

export interface CreatePaymentVoucherInput {
  cashBankAccountId: string;
  voucherDate: string;
  partyType: VoucherPartyType;
  customerId?: string;
  supplierId?: string;
  otherAccountId?: string;
  amount: string;
  description?: string;
}

export interface BankTransfer {
  id: string;
  companyId: string;
  transferNumber: string;
  transferDate: string;
  fromAccountId: string;
  fromAccount: CashBankAccount;
  toAccountId: string;
  toAccount: CashBankAccount;
  amount: string;
  description: string | null;
  status: VoucherStatus;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

export interface CreateBankTransferInput {
  fromAccountId: string;
  toAccountId: string;
  transferDate: string;
  amount: string;
  description?: string;
}

export interface BankReconciliation {
  id: string;
  companyId: string;
  cashBankAccountId: string;
  statementDate: string;
  statementBalance: string;
  bookBalance: string;
  difference: string;
  createdAt: string;
}

export interface RunReconciliationInput {
  cashBankAccountId: string;
  statementDate: string;
  statementBalance: string;
}

export interface UnreconciledItems {
  receipts: ReceiptVoucher[];
  payments: PaymentVoucher[];
  transfersOut: BankTransfer[];
  transfersIn: BankTransfer[];
}

export interface MarkReconciledInput {
  receiptVoucherIds?: string[];
  paymentVoucherIds?: string[];
  bankTransferIds?: string[];
}

export const bankingApi = {
  accounts: {
    list: () => api.get<CashBankAccount[]>("/banking/accounts"),
    get: (id: string) => api.get<CashBankAccount>(`/banking/accounts/${id}`),
    balance: (id: string) => api.get<{ balance: string }>(`/banking/accounts/${id}/balance`),
    create: (input: CreateCashBankAccountInput) => api.post<CashBankAccount>("/banking/accounts", input),
  },
  receiptVouchers: {
    list: () => api.get<ReceiptVoucher[]>("/banking/receipt-vouchers"),
    get: (id: string) => api.get<ReceiptVoucher>(`/banking/receipt-vouchers/${id}`),
    create: (input: CreateReceiptVoucherInput) => api.post<ReceiptVoucher>("/banking/receipt-vouchers", input),
    post: (id: string) => api.post<ReceiptVoucher>(`/banking/receipt-vouchers/${id}/post`),
  },
  paymentVouchers: {
    list: () => api.get<PaymentVoucher[]>("/banking/payment-vouchers"),
    get: (id: string) => api.get<PaymentVoucher>(`/banking/payment-vouchers/${id}`),
    create: (input: CreatePaymentVoucherInput) => api.post<PaymentVoucher>("/banking/payment-vouchers", input),
    post: (id: string) => api.post<PaymentVoucher>(`/banking/payment-vouchers/${id}/post`),
  },
  transfers: {
    list: () => api.get<BankTransfer[]>("/banking/transfers"),
    get: (id: string) => api.get<BankTransfer>(`/banking/transfers/${id}`),
    create: (input: CreateBankTransferInput) => api.post<BankTransfer>("/banking/transfers", input),
    post: (id: string) => api.post<BankTransfer>(`/banking/transfers/${id}/post`),
  },
  reconciliations: {
    list: (cashBankAccountId: string) => api.get<BankReconciliation[]>(`/banking/reconciliations?cashBankAccountId=${cashBankAccountId}`),
    unreconciled: (cashBankAccountId: string, asOfDate: string) =>
      api.get<UnreconciledItems>(`/banking/reconciliations/unreconciled?cashBankAccountId=${cashBankAccountId}&asOfDate=${asOfDate}`),
    run: (input: RunReconciliationInput) => api.post<BankReconciliation>("/banking/reconciliations", input),
    markReconciled: (input: MarkReconciledInput) => api.post<{ reconciled: boolean }>("/banking/reconciliations/mark-reconciled", input),
  },
};
