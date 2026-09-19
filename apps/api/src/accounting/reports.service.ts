import { Injectable, NotFoundException } from "@nestjs/common";
import { AccountType, JournalEntryStatus, NormalBalance, Prisma, PurchaseDocStatus, SalesDocStatus, VoucherStatus } from "@prisma/client";
import Decimal from "decimal.js";

const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
type AgingBucket = (typeof AGING_BUCKETS)[number];

function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

/**
 * Both reports below are computed live, directly from journal_entry_lines —
 * there is no separate "balances" table that could drift out of sync with
 * the ledger. This is deliberate (see docs/ARCHITECTURE.md §5): the
 * journal is the single source of truth, and every report is just a
 * different aggregation of it.
 *
 * Both POSTED and REVERSED entries count as real ledger activity: REVERSED
 * only means "this posted entry has since been cancelled by a separate
 * reversal entry" (see JournalEntriesService.reverse) — its own lines
 * still happened and must stay in every report, otherwise the reversal's
 * equal-and-opposite lines would have nothing left to cancel out and a
 * fully-reversed account would show a nonzero balance instead of zero.
 */
const LEDGER_STATUSES = [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED];

@Injectable()
export class ReportsService {
  async trialBalance(tx: Prisma.TransactionClient, companyId: string, asOfDate: Date) {
    const lines = await tx.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: { in: LEDGER_STATUSES }, entryDate: { lte: asOfDate } },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { code: string; name: string; nameAr: string | null; normalBalance: NormalBalance; debit: Decimal; credit: Decimal }
    >();

    for (const line of lines) {
      const existing = byAccount.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        nameAr: line.account.nameAr,
        normalBalance: line.account.normalBalance,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      existing.debit = existing.debit.plus(line.debit.toString());
      existing.credit = existing.credit.plus(line.credit.toString());
      byAccount.set(line.accountId, existing);
    }

    const rows = Array.from(byAccount.entries())
      .map(([accountId, v]) => ({
        accountId,
        code: v.code,
        name: v.name,
        nameAr: v.nameAr,
        totalDebit: v.debit.toFixed(4),
        totalCredit: v.credit.toFixed(4),
        // Signed balance in the account's own normal-balance direction —
        // a positive number always means "a balance in the normal
        // direction for this account type".
        balance: (v.normalBalance === NormalBalance.DEBIT ? v.debit.minus(v.credit) : v.credit.minus(v.debit)).toFixed(4),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = rows.reduce((sum, r) => sum.plus(r.totalDebit), new Decimal(0));
    const totalCredit = rows.reduce((sum, r) => sum.plus(r.totalCredit), new Decimal(0));

    return { asOfDate: asOfDate.toISOString().slice(0, 10), rows, totalDebit: totalDebit.toFixed(4), totalCredit: totalCredit.toFixed(4) };
  }

  async generalLedger(tx: Prisma.TransactionClient, companyId: string, accountId: string, dateFrom?: Date, dateTo?: Date) {
    const account = await tx.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new NotFoundException("Account not found");

    const lines = await tx.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: { in: LEDGER_STATUSES },
          entryDate: { gte: dateFrom, lte: dateTo },
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: "asc" } },
    });

    let running = new Decimal(0);
    const direction = account.normalBalance === NormalBalance.DEBIT ? 1 : -1;
    const rows = lines.map((line) => {
      const debit = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());
      running = running.plus(debit.minus(credit).times(direction));
      return {
        entryNumber: line.journalEntry.entryNumber,
        entryDate: line.journalEntry.entryDate.toISOString().slice(0, 10),
        description: line.description ?? line.journalEntry.description,
        debit: debit.toFixed(4),
        credit: credit.toFixed(4),
        runningBalance: running.toFixed(4),
      };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, normalBalance: account.normalBalance },
      rows,
      endingBalance: running.toFixed(4),
    };
  }

  /** Revenue and expenses actually earned/incurred within a date range —
   * unlike the trial balance's cumulative-since-inception view, this sums
   * only entries dated inside [dateFrom, dateTo], since an income
   * statement is a period report, not a point-in-time one. */
  async incomeStatement(tx: Prisma.TransactionClient, companyId: string, dateFrom: Date, dateTo: Date) {
    const lines = await tx.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId,
          status: { in: LEDGER_STATUSES },
          entryDate: { gte: dateFrom, lte: dateTo },
        },
        account: { accountType: { in: [AccountType.REVENUE, AccountType.EXPENSE] } },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { code: string; name: string; nameAr: string | null; accountType: AccountType; amount: Decimal }
    >();
    for (const line of lines) {
      const existing = byAccount.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        nameAr: line.account.nameAr,
        accountType: line.account.accountType,
        amount: new Decimal(0),
      };
      // Revenue is credit-normal, expense is debit-normal — express both
      // as a positive "how much of this account's natural thing happened".
      const delta =
        line.account.accountType === AccountType.REVENUE
          ? new Decimal(line.credit.toString()).minus(line.debit.toString())
          : new Decimal(line.debit.toString()).minus(line.credit.toString());
      existing.amount = existing.amount.plus(delta);
      byAccount.set(line.accountId, existing);
    }

    const revenueRows: { accountId: string; code: string; name: string; nameAr: string | null; amount: string }[] = [];
    const expenseRows: { accountId: string; code: string; name: string; nameAr: string | null; amount: string }[] = [];
    for (const [accountId, v] of byAccount) {
      const row = { accountId, code: v.code, name: v.name, nameAr: v.nameAr, amount: v.amount.toFixed(4) };
      if (v.accountType === AccountType.REVENUE) revenueRows.push(row);
      else expenseRows.push(row);
    }
    revenueRows.sort((a, b) => a.code.localeCompare(b.code));
    expenseRows.sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = revenueRows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
    const totalExpenses = expenseRows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));

    return {
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      revenue: revenueRows,
      expenses: expenseRows,
      totalRevenue: totalRevenue.toFixed(4),
      totalExpenses: totalExpenses.toFixed(4),
      netIncome: totalRevenue.minus(totalExpenses).toFixed(4),
    };
  }

  /**
   * Assets, liabilities and equity as of a date — plus, since this system
   * has no automated year-end closing entry that sweeps revenue/expense
   * into retained earnings (docs/ARCHITECTURE.md — a documented scope
   * boundary, not an oversight), a computed "Net Income (Undistributed)"
   * equity line equal to all revenue minus all expenses ever recorded up
   * to that date. Without it Assets would never equal Liabilities +
   * Equity, since the P&L accounts that funded those assets would be
   * missing from the equity side entirely.
   */
  async balanceSheet(tx: Prisma.TransactionClient, companyId: string, asOfDate: Date) {
    const lines = await tx.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: { in: LEDGER_STATUSES }, entryDate: { lte: asOfDate } } },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { code: string; name: string; nameAr: string | null; accountType: AccountType; normalBalance: NormalBalance; debit: Decimal; credit: Decimal }
    >();
    for (const line of lines) {
      const existing = byAccount.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        nameAr: line.account.nameAr,
        accountType: line.account.accountType,
        normalBalance: line.account.normalBalance,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      existing.debit = existing.debit.plus(line.debit.toString());
      existing.credit = existing.credit.plus(line.credit.toString());
      byAccount.set(line.accountId, existing);
    }

    const section = (type: AccountType) =>
      Array.from(byAccount.entries())
        .filter(([, v]) => v.accountType === type)
        .map(([accountId, v]) => ({
          accountId,
          code: v.code,
          name: v.name,
          nameAr: v.nameAr,
          balance: (v.normalBalance === NormalBalance.DEBIT ? v.debit.minus(v.credit) : v.credit.minus(v.debit)).toFixed(4),
        }))
        .sort((a, b) => a.code.localeCompare(b.code));

    const assets = section(AccountType.ASSET);
    const liabilities = section(AccountType.LIABILITY);
    const equity = section(AccountType.EQUITY);

    let totalRevenue = new Decimal(0);
    let totalExpenses = new Decimal(0);
    for (const v of byAccount.values()) {
      if (v.accountType === AccountType.REVENUE) totalRevenue = totalRevenue.plus(v.credit.minus(v.debit));
      if (v.accountType === AccountType.EXPENSE) totalExpenses = totalExpenses.plus(v.debit.minus(v.credit));
    }
    const netIncome = totalRevenue.minus(totalExpenses);

    const totalAssets = assets.reduce((sum, r) => sum.plus(r.balance), new Decimal(0));
    const totalLiabilities = liabilities.reduce((sum, r) => sum.plus(r.balance), new Decimal(0));
    const totalEquityRecorded = equity.reduce((sum, r) => sum.plus(r.balance), new Decimal(0));
    const totalEquity = totalEquityRecorded.plus(netIncome);

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      assets,
      liabilities,
      equity,
      netIncomeUndistributed: netIncome.toFixed(4),
      totalAssets: totalAssets.toFixed(4),
      totalLiabilities: totalLiabilities.toFixed(4),
      totalEquity: totalEquity.toFixed(4),
      isBalanced: totalAssets.minus(totalLiabilities.plus(totalEquity)).abs().lt("0.0001"),
    };
  }

  /**
   * How much each customer still owes, per open invoice, bucketed by how
   * overdue it is. "Still owes" is computed as invoice total minus the
   * posted receipt vouchers explicitly linked to that invoice
   * (ReceiptVoucher.salesInvoiceId) — a receipt with no invoice link
   * (the common case today, since allocation is optional) simply isn't
   * counted against any invoice here, so an invoice can show as still
   * open even after a same-amount unlinked receipt was posted. This is a
   * documented scope boundary (docs/REPORTS.md), not a bug: full
   * automatic allocation across multiple invoices is a separate,
   * larger feature.
   */
  async arAging(tx: Prisma.TransactionClient, companyId: string, asOfDate: Date) {
    const invoices = await tx.salesInvoice.findMany({
      where: { companyId, status: SalesDocStatus.POSTED },
      include: { customer: true, receiptVouchers: { where: { status: VoucherStatus.POSTED } } },
    });

    const byCustomer = new Map<
      string,
      { code: string; name: string; buckets: Record<AgingBucket, Decimal>; total: Decimal }
    >();
    const openInvoices: {
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
    }[] = [];

    for (const invoice of invoices) {
      const paid = invoice.receiptVouchers.reduce((sum, rv) => sum.plus(rv.amount.toString()), new Decimal(0));
      const remaining = new Decimal(invoice.total.toString()).minus(paid);
      if (remaining.lte("0.0001")) continue;

      const referenceDate = invoice.dueDate ?? invoice.invoiceDate;
      const daysOverdue = Math.floor((asOfDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = agingBucket(daysOverdue);

      openInvoices.push({
        customerId: invoice.customerId,
        customerCode: invoice.customer.code,
        customerName: invoice.customer.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
        total: invoice.total.toString(),
        paid: paid.toFixed(4),
        remaining: remaining.toFixed(4),
        daysOverdue,
        bucket,
      });

      const entry = byCustomer.get(invoice.customerId) ?? {
        code: invoice.customer.code,
        name: invoice.customer.name,
        buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, new Decimal(0)])) as Record<AgingBucket, Decimal>,
        total: new Decimal(0),
      };
      entry.buckets[bucket] = entry.buckets[bucket].plus(remaining);
      entry.total = entry.total.plus(remaining);
      byCustomer.set(invoice.customerId, entry);
    }

    const byCustomerRows = Array.from(byCustomer.entries())
      .map(([customerId, v]) => ({
        customerId,
        code: v.code,
        name: v.name,
        ...Object.fromEntries(AGING_BUCKETS.map((b) => [b, v.buckets[b].toFixed(4)])),
        total: v.total.toFixed(4),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const grandTotal = byCustomerRows.reduce((sum, r) => sum.plus(r.total), new Decimal(0));

    return { asOfDate: asOfDate.toISOString().slice(0, 10), invoices: openInvoices, byCustomer: byCustomerRows, grandTotal: grandTotal.toFixed(4) };
  }

  /** Mirrors arAging exactly, for suppliers/purchase invoices/payment vouchers. */
  async apAging(tx: Prisma.TransactionClient, companyId: string, asOfDate: Date) {
    const invoices = await tx.purchaseInvoice.findMany({
      where: { companyId, status: PurchaseDocStatus.POSTED },
      include: { supplier: true, paymentVouchers: { where: { status: VoucherStatus.POSTED } } },
    });

    const bySupplier = new Map<
      string,
      { code: string; name: string; buckets: Record<AgingBucket, Decimal>; total: Decimal }
    >();
    const openInvoices: {
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
    }[] = [];

    for (const invoice of invoices) {
      const paid = invoice.paymentVouchers.reduce((sum, pv) => sum.plus(pv.amount.toString()), new Decimal(0));
      const remaining = new Decimal(invoice.total.toString()).minus(paid);
      if (remaining.lte("0.0001")) continue;

      const referenceDate = invoice.dueDate ?? invoice.invoiceDate;
      const daysOverdue = Math.floor((asOfDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = agingBucket(daysOverdue);

      openInvoices.push({
        supplierId: invoice.supplierId,
        supplierCode: invoice.supplier.code,
        supplierName: invoice.supplier.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
        total: invoice.total.toString(),
        paid: paid.toFixed(4),
        remaining: remaining.toFixed(4),
        daysOverdue,
        bucket,
      });

      const entry = bySupplier.get(invoice.supplierId) ?? {
        code: invoice.supplier.code,
        name: invoice.supplier.name,
        buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, new Decimal(0)])) as Record<AgingBucket, Decimal>,
        total: new Decimal(0),
      };
      entry.buckets[bucket] = entry.buckets[bucket].plus(remaining);
      entry.total = entry.total.plus(remaining);
      bySupplier.set(invoice.supplierId, entry);
    }

    const bySupplierRows = Array.from(bySupplier.entries())
      .map(([supplierId, v]) => ({
        supplierId,
        code: v.code,
        name: v.name,
        ...Object.fromEntries(AGING_BUCKETS.map((b) => [b, v.buckets[b].toFixed(4)])),
        total: v.total.toFixed(4),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const grandTotal = bySupplierRows.reduce((sum, r) => sum.plus(r.total), new Decimal(0));

    return { asOfDate: asOfDate.toISOString().slice(0, 10), invoices: openInvoices, bySupplier: bySupplierRows, grandTotal: grandTotal.toFixed(4) };
  }
}
