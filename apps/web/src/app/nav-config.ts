import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListTree,
  BookText,
  Landmark,
  CalendarRange,
  Scale,
  FileBarChart,
  BookOpenCheck,
  Users,
  ReceiptText,
  Truck,
  FileStack,
  Package,
  Warehouse,
  FolderTree,
  ClipboardList,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  AlarmClock,
  Factory,
  ListChecks,
  Calculator,
  Cog,
  Building2,
  Archive,
  TrendingDown,
  Network,
  IdCard,
  Contact,
  CalendarDays,
  Wallet,
  Percent,
  Layers,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  ClipboardSignature,
  History,
  CalendarClock,
} from "lucide-react";

export interface NavItem {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Permission required to see this item — omit for items everyone with
   * an active company can see (e.g. Dashboard). Checked against
   * useAuth().hasPermission, which is itself sourced from the real
   * permission list on GET /users/me — nothing here is decorative: an
   * item only appears once its page actually exists AND the account has
   * the permission the backend would also enforce. */
  permission?: string;
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

/** Grows one module at a time as each module's real pages are wired to
 * the real API — never add an item here for a page that doesn't exist
 * yet (see the project's "no mock UI" rule). */
export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.dashboard",
    items: [{ path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.accounting",
    items: [
      {
        path: "/accounting/chart-of-accounts",
        labelKey: "nav.chartOfAccounts",
        icon: ListTree,
        permission: "accounting.chart_of_accounts.view",
      },
      {
        path: "/accounting/journal-entries",
        labelKey: "nav.journalEntries",
        icon: BookText,
        permission: "accounting.journal_entry.view",
      },
      {
        path: "/accounting/cost-centers",
        labelKey: "nav.costCenters",
        icon: Landmark,
        permission: "accounting.cost_center.view",
      },
      {
        path: "/accounting/fiscal-years",
        labelKey: "accounting.fiscalYears",
        icon: CalendarRange,
        permission: "core.fiscal_period.view",
      },
      {
        path: "/accounting/reports/trial-balance",
        labelKey: "accounting.trialBalance",
        icon: Scale,
        permission: "accounting.financial_report.view",
      },
      {
        path: "/accounting/reports/general-ledger",
        labelKey: "nav.generalLedger",
        icon: BookOpenCheck,
        permission: "accounting.financial_report.view",
      },
      {
        path: "/accounting/reports/income-statement",
        labelKey: "accounting.incomeStatement",
        icon: FileBarChart,
        permission: "accounting.financial_report.view",
      },
      {
        path: "/accounting/reports/balance-sheet",
        labelKey: "accounting.balanceSheet",
        icon: FileBarChart,
        permission: "accounting.financial_report.view",
      },
      {
        path: "/accounting/reports/ar-aging",
        labelKey: "accounting.arAging",
        icon: History,
        permission: "accounting.financial_report.view",
      },
      {
        path: "/accounting/reports/ap-aging",
        labelKey: "accounting.apAging",
        icon: CalendarClock,
        permission: "accounting.financial_report.view",
      },
    ],
  },
  {
    labelKey: "nav.sales",
    items: [
      { path: "/sales/customers", labelKey: "nav.customers", icon: Users, permission: "sales.customer.view" },
      { path: "/sales/invoices", labelKey: "nav.salesInvoices", icon: ReceiptText, permission: "sales.sales_invoice.view" },
    ],
  },
  {
    labelKey: "nav.purchasing",
    items: [
      { path: "/purchasing/suppliers", labelKey: "nav.suppliers", icon: Truck, permission: "purchasing.supplier.view" },
      {
        path: "/purchasing/invoices",
        labelKey: "nav.purchaseInvoices",
        icon: FileStack,
        permission: "purchasing.purchase_invoice.view",
      },
    ],
  },
  {
    labelKey: "nav.inventory",
    items: [
      { path: "/inventory/items", labelKey: "nav.items", icon: Package, permission: "inventory.item.view" },
      { path: "/inventory/categories", labelKey: "inventory.categories", icon: FolderTree, permission: "inventory.item.view" },
      { path: "/inventory/warehouses", labelKey: "nav.warehouses", icon: Warehouse, permission: "inventory.warehouse.view" },
      {
        path: "/inventory/stock-balances",
        labelKey: "inventory.stockBalances",
        icon: ClipboardList,
        permission: "inventory.item.view",
      },
      {
        path: "/inventory/transfers",
        labelKey: "inventory.transfers",
        icon: ArrowLeftRight,
        permission: "inventory.stock_transfer.create",
      },
      {
        path: "/inventory/adjustments",
        labelKey: "inventory.adjustments",
        icon: SlidersHorizontal,
        permission: "inventory.stock_adjustment.create",
      },
      {
        path: "/inventory/stock-counts",
        labelKey: "inventory.stockCounts",
        icon: ClipboardCheck,
        permission: "inventory.stock_count.view",
      },
      {
        path: "/inventory/expiring-batches",
        labelKey: "inventory.expiringBatches",
        icon: AlarmClock,
        permission: "inventory.item.view",
      },
    ],
  },
  {
    labelKey: "nav.manufacturing",
    items: [
      {
        path: "/manufacturing/work-centers",
        labelKey: "manufacturing.workCenters",
        icon: Cog,
        permission: "manufacturing.work_center.view",
      },
      {
        path: "/manufacturing/boms",
        labelKey: "manufacturing.boms",
        icon: ListChecks,
        permission: "manufacturing.bom.view",
      },
      {
        path: "/manufacturing/standard-costs",
        labelKey: "manufacturing.standardCosts",
        icon: Calculator,
        permission: "manufacturing.standard_cost.view",
      },
      {
        path: "/manufacturing/production-orders",
        labelKey: "manufacturing.productionOrders",
        icon: Factory,
        permission: "manufacturing.production_order.view",
      },
    ],
  },
  {
    labelKey: "nav.fixedAssets",
    items: [
      {
        path: "/fixed-assets/categories",
        labelKey: "fixedAssets.categories",
        icon: Building2,
        permission: "fixed_assets.asset_category.view",
      },
      {
        path: "/fixed-assets/assets",
        labelKey: "fixedAssets.assets",
        icon: Archive,
        permission: "fixed_assets.fixed_asset.view",
      },
      {
        path: "/fixed-assets/depreciation-runs",
        labelKey: "fixedAssets.depreciationRuns",
        icon: TrendingDown,
        permission: "fixed_assets.depreciation_run.post",
      },
    ],
  },
  {
    labelKey: "nav.hr",
    items: [
      { path: "/hr/departments", labelKey: "hr.departments", icon: Network, permission: "hr.department.view" },
      { path: "/hr/positions", labelKey: "hr.positions", icon: IdCard, permission: "hr.department.view" },
      { path: "/hr/employees", labelKey: "hr.employees", icon: Contact, permission: "hr.employee.view" },
      { path: "/hr/leaves", labelKey: "hr.leaves", icon: CalendarDays, permission: "hr.leave.view" },
      { path: "/hr/payroll-runs", labelKey: "hr.payrollRuns", icon: Wallet, permission: "hr.payroll_run.view" },
    ],
  },
  {
    labelKey: "nav.taxes",
    items: [
      { path: "/tax/types", labelKey: "tax.taxTypes", icon: Percent, permission: "tax.tax_type.view" },
      { path: "/tax/groups", labelKey: "tax.taxGroups", icon: Layers, permission: "tax.tax_group.view" },
    ],
  },
  {
    labelKey: "nav.banking",
    items: [
      { path: "/banking/accounts", labelKey: "banking.accounts", icon: Banknote, permission: "banking.cash_bank_account.view" },
      {
        path: "/banking/receipt-vouchers",
        labelKey: "banking.receiptVouchers",
        icon: ArrowDownToLine,
        permission: "banking.receipt_voucher.view",
      },
      {
        path: "/banking/payment-vouchers",
        labelKey: "banking.paymentVouchers",
        icon: ArrowUpFromLine,
        permission: "banking.payment_voucher.view",
      },
      { path: "/banking/transfers", labelKey: "banking.transfers", icon: Repeat, permission: "banking.bank_transfer.view" },
      {
        path: "/banking/reconciliation",
        labelKey: "banking.reconciliation",
        icon: ClipboardSignature,
        permission: "banking.bank_reconciliation.view",
      },
    ],
  },
];
