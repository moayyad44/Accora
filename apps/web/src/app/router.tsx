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

          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
