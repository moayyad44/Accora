import { Injectable, NotFoundException } from "@nestjs/common";
import { JournalEntryStatus, NormalBalance, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

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
}
