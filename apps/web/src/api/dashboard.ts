import { api } from "./client";

export interface DashboardSummary {
  asOfDate: string;
  currentPeriod: { id: string; name: string; startDate: string } | null;
  totalCashAndBank: string;
  totalAccountsReceivable: string;
  totalAccountsPayable: string;
  periodRevenue: string;
  periodExpenses: string;
  periodNetIncome: string;
}

export const dashboardApi = {
  summary: (asOfDate?: string) =>
    api.get<DashboardSummary>(`/dashboard/summary${asOfDate ? `?asOfDate=${asOfDate}` : ""}`),
};
