import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterCompanyPage } from "@/features/auth/RegisterCompanyPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ChartOfAccountsPage } from "@/features/accounting/ChartOfAccountsPage";
import { JournalEntriesListPage } from "@/features/accounting/JournalEntriesListPage";
import { NewJournalEntryPage } from "@/features/accounting/NewJournalEntryPage";
import { JournalEntryDetailPage } from "@/features/accounting/JournalEntryDetailPage";
import { CostCentersPage } from "@/features/accounting/CostCentersPage";
import { FiscalYearsPage } from "@/features/accounting/FiscalYearsPage";
import { TrialBalancePage } from "@/features/accounting/reports/TrialBalancePage";
import { GeneralLedgerPage } from "@/features/accounting/reports/GeneralLedgerPage";
import { IncomeStatementPage } from "@/features/accounting/reports/IncomeStatementPage";
import { BalanceSheetPage } from "@/features/accounting/reports/BalanceSheetPage";
import { ArAgingPage } from "@/features/accounting/reports/ArAgingPage";
import { ApAgingPage } from "@/features/accounting/reports/ApAgingPage";
import { CustomersPage } from "@/features/parties/CustomersPage";
import { SuppliersPage } from "@/features/parties/SuppliersPage";
import { ItemsPage } from "@/features/inventory/ItemsPage";
import { WarehousesPage } from "@/features/inventory/WarehousesPage";
import { CategoriesPage } from "@/features/inventory/CategoriesPage";
import { StockBalancesPage } from "@/features/inventory/StockBalancesPage";
import { ItemCardPage } from "@/features/inventory/ItemCardPage";
import { TransfersPage } from "@/features/inventory/TransfersPage";
import { AdjustmentsPage } from "@/features/inventory/AdjustmentsPage";
import { StockCountsListPage } from "@/features/inventory/StockCountsListPage";
import { NewStockCountPage } from "@/features/inventory/NewStockCountPage";
import { StockCountDetailPage } from "@/features/inventory/StockCountDetailPage";
import { ExpiringBatchesPage } from "@/features/inventory/ExpiringBatchesPage";
import { WorkCentersPage } from "@/features/manufacturing/WorkCentersPage";
import { BomsListPage } from "@/features/manufacturing/BomsListPage";
import { NewBomPage } from "@/features/manufacturing/NewBomPage";
import { BomDetailPage } from "@/features/manufacturing/BomDetailPage";
import { StandardCostsPage } from "@/features/manufacturing/StandardCostsPage";
import { ProductionOrdersListPage } from "@/features/manufacturing/ProductionOrdersListPage";
import { NewProductionOrderPage } from "@/features/manufacturing/NewProductionOrderPage";
import { ProductionOrderDetailPage } from "@/features/manufacturing/ProductionOrderDetailPage";
import { AssetCategoriesPage } from "@/features/fixed-assets/AssetCategoriesPage";
import { FixedAssetsListPage } from "@/features/fixed-assets/FixedAssetsListPage";
import { NewFixedAssetPage } from "@/features/fixed-assets/NewFixedAssetPage";
import { FixedAssetDetailPage } from "@/features/fixed-assets/FixedAssetDetailPage";
import { DepreciationRunPage } from "@/features/fixed-assets/DepreciationRunPage";
import { DepartmentsPage } from "@/features/hr/DepartmentsPage";
import { PositionsPage } from "@/features/hr/PositionsPage";
import { EmployeesListPage } from "@/features/hr/EmployeesListPage";
import { EmployeeDetailPage } from "@/features/hr/EmployeeDetailPage";
import { LeavesPage } from "@/features/hr/LeavesPage";
import { PayrollRunsListPage } from "@/features/hr/PayrollRunsListPage";
import { PayrollRunDetailPage } from "@/features/hr/PayrollRunDetailPage";
import { TaxTypesPage } from "@/features/tax/TaxTypesPage";
import { TaxTypeDetailPage } from "@/features/tax/TaxTypeDetailPage";
import { TaxGroupsPage } from "@/features/tax/TaxGroupsPage";
import { CashBankAccountsPage } from "@/features/banking/CashBankAccountsPage";
import { ReceiptVouchersPage } from "@/features/banking/ReceiptVouchersPage";
import { PaymentVouchersPage } from "@/features/banking/PaymentVouchersPage";
import { BankTransfersPage } from "@/features/banking/BankTransfersPage";
import { ReconciliationPage } from "@/features/banking/ReconciliationPage";
import { SalesInvoicesListPage } from "@/features/sales/SalesInvoicesListPage";
import { NewSalesInvoicePage } from "@/features/sales/NewSalesInvoicePage";
import { SalesInvoiceDetailPage } from "@/features/sales/SalesInvoiceDetailPage";
import { PurchaseInvoicesListPage } from "@/features/purchasing/PurchaseInvoicesListPage";
import { NewPurchaseInvoicePage } from "@/features/purchasing/NewPurchaseInvoicePage";
import { PurchaseInvoiceDetailPage } from "@/features/purchasing/PurchaseInvoiceDetailPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register-company" element={<RegisterCompanyPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/accounting/journal-entries" element={<JournalEntriesListPage />} />
          <Route path="/accounting/journal-entries/new" element={<NewJournalEntryPage />} />
          <Route path="/accounting/journal-entries/:id" element={<JournalEntryDetailPage />} />
          <Route path="/accounting/cost-centers" element={<CostCentersPage />} />
          <Route path="/accounting/fiscal-years" element={<FiscalYearsPage />} />
          <Route path="/accounting/reports/trial-balance" element={<TrialBalancePage />} />
          <Route path="/accounting/reports/general-ledger" element={<GeneralLedgerPage />} />
          <Route path="/accounting/reports/income-statement" element={<IncomeStatementPage />} />
          <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/accounting/reports/ar-aging" element={<ArAgingPage />} />
          <Route path="/accounting/reports/ap-aging" element={<ApAgingPage />} />

          <Route path="/sales/customers" element={<CustomersPage />} />
          <Route path="/sales/invoices" element={<SalesInvoicesListPage />} />
          <Route path="/sales/invoices/new" element={<NewSalesInvoicePage />} />
          <Route path="/sales/invoices/:id" element={<SalesInvoiceDetailPage />} />

          <Route path="/purchasing/suppliers" element={<SuppliersPage />} />
          <Route path="/purchasing/invoices" element={<PurchaseInvoicesListPage />} />
          <Route path="/purchasing/invoices/new" element={<NewPurchaseInvoicePage />} />
          <Route path="/purchasing/invoices/:id" element={<PurchaseInvoiceDetailPage />} />

          <Route path="/inventory/items" element={<ItemsPage />} />
          <Route path="/inventory/categories" element={<CategoriesPage />} />
          <Route path="/inventory/warehouses" element={<WarehousesPage />} />
          <Route path="/inventory/stock-balances" element={<StockBalancesPage />} />
          <Route path="/inventory/items/:itemId/card" element={<ItemCardPage />} />
          <Route path="/inventory/transfers" element={<TransfersPage />} />
          <Route path="/inventory/adjustments" element={<AdjustmentsPage />} />
          <Route path="/inventory/stock-counts" element={<StockCountsListPage />} />
          <Route path="/inventory/stock-counts/new" element={<NewStockCountPage />} />
          <Route path="/inventory/stock-counts/:id" element={<StockCountDetailPage />} />

          <Route path="/inventory/expiring-batches" element={<ExpiringBatchesPage />} />

          <Route path="/manufacturing/work-centers" element={<WorkCentersPage />} />
          <Route path="/manufacturing/boms" element={<BomsListPage />} />
          <Route path="/manufacturing/boms/new" element={<NewBomPage />} />
          <Route path="/manufacturing/boms/:id" element={<BomDetailPage />} />
          <Route path="/manufacturing/standard-costs" element={<StandardCostsPage />} />
          <Route path="/manufacturing/production-orders" element={<ProductionOrdersListPage />} />
          <Route path="/manufacturing/production-orders/new" element={<NewProductionOrderPage />} />
          <Route path="/manufacturing/production-orders/:id" element={<ProductionOrderDetailPage />} />

          <Route path="/fixed-assets/categories" element={<AssetCategoriesPage />} />
          <Route path="/fixed-assets/assets" element={<FixedAssetsListPage />} />
          <Route path="/fixed-assets/assets/new" element={<NewFixedAssetPage />} />
          <Route path="/fixed-assets/assets/:id" element={<FixedAssetDetailPage />} />
          <Route path="/fixed-assets/depreciation-runs" element={<DepreciationRunPage />} />

          <Route path="/hr/departments" element={<DepartmentsPage />} />
          <Route path="/hr/positions" element={<PositionsPage />} />
          <Route path="/hr/employees" element={<EmployeesListPage />} />
          <Route path="/hr/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/hr/leaves" element={<LeavesPage />} />
          <Route path="/hr/payroll-runs" element={<PayrollRunsListPage />} />
          <Route path="/hr/payroll-runs/:id" element={<PayrollRunDetailPage />} />

          <Route path="/tax/types" element={<TaxTypesPage />} />
          <Route path="/tax/types/:id" element={<TaxTypeDetailPage />} />
          <Route path="/tax/groups" element={<TaxGroupsPage />} />

          <Route path="/banking/accounts" element={<CashBankAccountsPage />} />
          <Route path="/banking/receipt-vouchers" element={<ReceiptVouchersPage />} />
          <Route path="/banking/payment-vouchers" element={<PaymentVouchersPage />} />
          <Route path="/banking/transfers" element={<BankTransfersPage />} />
          <Route path="/banking/reconciliation" element={<ReconciliationPage />} />

          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
