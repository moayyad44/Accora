import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ReportsService } from "../accounting/reports.service";
import { CashBankAccountsService } from "../banking/cash-bank-accounts.service";

/**
 * A quick "at a glance" financial snapshot, built entirely from the
 * reports/reconciled data that already exists — no separate cached
 * numbers to drift out of sync. Deliberately bounded to financial
 * figures (cash position, AR/AP, this period's revenue/expense/net
 * income); operational counts (headcount, low-stock items, etc.) are a
 * separate concern left for a future, more targeted dashboard.
 *
 * AR/AP here come from the company's DEFAULT_AR/DEFAULT_AP mapped
 * accounts' actual GL balance — the real ledger truth, always correct
 * regardless of whether any given receipt/payment was linked to a
 * specific invoice. A customer or supplier with its own account
 * override (arAccountId/apAccountId different from the company
 * default) isn't swept into this quick total; docs/REPORTS.md notes
 * this — for the exact, per-invoice breakdown, use arAging/apAging.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly cashBankAccountsService: CashBankAccountsService,
  ) {}

  async summary(tx: Prisma.TransactionClient, companyId: string, asOfDate: Date) {
    const trialBalance = await this.reportsService.trialBalance(tx, companyId, asOfDate);

    const [arMapping, apMapping, cashBankAccounts, currentPeriod] = await Promise.all([
      tx.accountMapping.findUnique({ where: { companyId_key: { companyId, key: "DEFAULT_AR" } } }),
      tx.accountMapping.findUnique({ where: { companyId_key: { companyId, key: "DEFAULT_AP" } } }),
      tx.cashBankAccount.findMany({ where: { companyId, isActive: true } }),
      tx.fiscalPeriod.findFirst({ where: { fiscalYear: { companyId }, startDate: { lte: asOfDate }, endDate: { gte: asOfDate } } }),
    ]);

    const arRow = arMapping ? trialBalance.rows.find((r) => r.accountId === arMapping.accountId) : undefined;
    const apRow = apMapping ? trialBalance.rows.find((r) => r.accountId === apMapping.accountId) : undefined;

    let totalCashAndBank = new Decimal(0);
    for (const account of cashBankAccounts) {
      totalCashAndBank = totalCashAndBank.plus(await this.cashBankAccountsService.currentBalance(tx, companyId, account.id));
    }

    let periodRevenue = "0.0000";
    let periodExpenses = "0.0000";
    let periodNetIncome = "0.0000";
    if (currentPeriod) {
      const income = await this.reportsService.incomeStatement(tx, companyId, currentPeriod.startDate, asOfDate);
      periodRevenue = income.totalRevenue;
      periodExpenses = income.totalExpenses;
      periodNetIncome = income.netIncome;
    }

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      currentPeriod: currentPeriod
        ? { id: currentPeriod.id, name: currentPeriod.name, startDate: currentPeriod.startDate.toISOString().slice(0, 10) }
        : null,
      totalCashAndBank: totalCashAndBank.toFixed(4),
      totalAccountsReceivable: arRow?.balance ?? "0.0000",
      totalAccountsPayable: apRow?.balance ?? "0.0000",
      periodRevenue,
      periodExpenses,
      periodNetIncome,
    };
  }
}
