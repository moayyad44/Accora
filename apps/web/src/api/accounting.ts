import { api } from "./client";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";
export type JournalEntryStatus = "DRAFT" | "POSTED" | "REVERSED";
export type JournalSourceType =
  | "MANUAL"
  | "SALES_INVOICE"
  | "PURCHASE_INVOICE"
  | "PRODUCTION_ORDER"
  | "DEPRECIATION"
  | "ASSET_DISPOSAL"
  | "PAYROLL"
  | "RECEIPT_VOUCHER"
  | "PAYMENT_VOUCHER"
  | "BANK_TRANSFER"
  | "STOCK_ADJUSTMENT"
  | "STOCK_COUNT";

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isHeader: boolean;
  isActive: boolean;
  currencyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountMapping {
  id: string;
  companyId: string;
  key: string;
  accountId: string;
  account: Account;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  nameAr?: string;
  parentId?: string | null;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isHeader?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  nameAr?: string;
  isActive?: boolean;
}

export interface CostCenter {
  id: string;
  companyId: string;
  branchId: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
  isActive: boolean;
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
  nameAr?: string;
  parentId?: string | null;
  branchId?: string | null;
}

export type FiscalPeriodStatus = "OPEN" | "CLOSED";

export interface FiscalPeriod {
  id: string;
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
}

export interface FiscalYear {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  periods: FiscalPeriod[];
}

export interface CreateFiscalYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;
  accountId: string;
  account?: Account;
  costCenterId: string | null;
  costCenter?: CostCenter | null;
  debit: string;
  credit: string;
  description: string | null;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  branchId: string | null;
  periodId: string;
  entryNumber: string;
  entryDate: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  description: string | null;
  status: JournalEntryStatus;
  reversalOfId: string | null;
  createdById: string;
  postedById: string | null;
  postedAt: string | null;
  createdAt: string;
  lines: JournalEntryLine[];
}

export interface CreateJournalEntryLineInput {
  accountId: string;
  costCenterId?: string;
  debit?: string;
  credit?: string;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  description?: string;
  branchId?: string;
  lines: CreateJournalEntryLineInput[];
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string | null;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}
export interface TrialBalance {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
}

export interface GeneralLedgerRow {
  entryNumber: string;
  entryDate: string;
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
}
export interface GeneralLedger {
  account: { id: string; code: string; name: string; normalBalance: NormalBalance };
  rows: GeneralLedgerRow[];
  endingBalance: string;
}

export interface IncomeStatementRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string | null;
  amount: string;
}
export interface IncomeStatement {
  dateFrom: string;
  dateTo: string;
  revenue: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
}

export interface BalanceSheetRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string | null;
  balance: string;
}
export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  netIncomeUndistributed: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  isBalanced: boolean;
}

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export interface AgingBucketAmounts {
  current: string;
  "1-30": string;
  "31-60": string;
  "61-90": string;
  "90+": string;
}

export interface ArAgingCustomerRow extends AgingBucketAmounts {
  customerId: string;
  code: string;
  name: string;
  total: string;
}
export interface ArAgingInvoiceRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  total: string;
  paid: string;
  remaining: string;
  daysOverdue: number;
  bucket: AgingBucket;
}
export interface ArAgingReport {
  asOfDate: string;
  invoices: ArAgingInvoiceRow[];
  byCustomer: ArAgingCustomerRow[];
  grandTotal: string;
}

export interface ApAgingSupplierRow extends AgingBucketAmounts {
  supplierId: string;
  code: string;
  name: string;
  total: string;
}
export interface ApAgingInvoiceRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  total: string;
  paid: string;
  remaining: string;
  daysOverdue: number;
  bucket: AgingBucket;
}
export interface ApAgingReport {
  asOfDate: string;
  invoices: ApAgingInvoiceRow[];
  bySupplier: ApAgingSupplierRow[];
  grandTotal: string;
}

export const accountingApi = {
  accounts: {
    list: () => api.get<Account[]>("/accounting/accounts"),
    create: (input: CreateAccountInput) => api.post<Account>("/accounting/accounts", input),
    update: (id: string, input: UpdateAccountInput) => api.patch<Account>(`/accounting/accounts/${id}`, input),
  },
  costCenters: {
    list: () => api.get<CostCenter[]>("/accounting/cost-centers"),
    create: (input: CreateCostCenterInput) => api.post<CostCenter>("/accounting/cost-centers", input),
  },
  accountMappings: {
    list: () => api.get<AccountMapping[]>("/accounting/account-mappings"),
    set: (key: string, accountId: string) => api.patch<AccountMapping>(`/accounting/account-mappings/${key}`, { accountId }),
  },
  fiscalYears: {
    list: () => api.get<FiscalYear[]>("/accounting/fiscal-years"),
    create: (input: CreateFiscalYearInput) => api.post<FiscalYear>("/accounting/fiscal-years", input),
    setPeriodStatus: (periodId: string, status: FiscalPeriodStatus) =>
      api.patch<FiscalPeriod>(`/accounting/fiscal-years/periods/${periodId}`, { status }),
  },
  journalEntries: {
    list: (status?: JournalEntryStatus) =>
      api.get<JournalEntry[]>(`/accounting/journal-entries${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<JournalEntry>(`/accounting/journal-entries/${id}`),
    create: (input: CreateJournalEntryInput) => api.post<JournalEntry>("/accounting/journal-entries", input),
    post: (id: string) => api.post<JournalEntry>(`/accounting/journal-entries/${id}/post`),
    reverse: (id: string) => api.post<JournalEntry>(`/accounting/journal-entries/${id}/reverse`),
  },
  reports: {
    trialBalance: (asOfDate?: string) =>
      api.get<TrialBalance>(`/accounting/reports/trial-balance${asOfDate ? `?asOfDate=${asOfDate}` : ""}`),
    generalLedger: (accountId: string, dateFrom?: string, dateTo?: string) => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const qs = params.toString();
      return api.get<GeneralLedger>(`/accounting/reports/general-ledger/${accountId}${qs ? `?${qs}` : ""}`);
    },
    incomeStatement: (dateFrom: string, dateTo: string) =>
      api.get<IncomeStatement>(`/accounting/reports/income-statement?dateFrom=${dateFrom}&dateTo=${dateTo}`),
    balanceSheet: (asOfDate?: string) =>
      api.get<BalanceSheet>(`/accounting/reports/balance-sheet${asOfDate ? `?asOfDate=${asOfDate}` : ""}`),
    arAging: (asOfDate?: string) => api.get<ArAgingReport>(`/accounting/reports/ar-aging${asOfDate ? `?asOfDate=${asOfDate}` : ""}`),
    apAging: (asOfDate?: string) => api.get<ApAgingReport>(`/accounting/reports/ap-aging${asOfDate ? `?asOfDate=${asOfDate}` : ""}`),
  },
};
