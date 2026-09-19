import { Injectable, NotFoundException } from "@nestjs/common";
import { JournalEntryStatus, Prisma, VoucherStatus } from "@prisma/client";
import Decimal from "decimal.js";

export interface RunReconciliationInput {
  cashBankAccountId: string;
  statementDate: Date;
  statementBalance: string;
}

export interface MarkReconciledInput {
  receiptVoucherIds?: string[];
  paymentVoucherIds?: string[];
  bankTransferIds?: string[];
}

// A reversed entry's own lines must still count (they're what the
// reversal entry nets against to reach zero) — same principle documented
// in ReportsService.LEDGER_STATUSES.
const LEDGER_STATUSES = [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED];

/**
 * Bank reconciliation, kept honest and bounded in scope: it compares the
 * account's book balance (everything posted through the GL as of a
 * statement date) against the statement's own ending balance and records
 * the difference — it does not import or auto-match statement lines. The
 * user reviews what's still unreconciled (listUnreconciled) and marks
 * specific vouchers/transfers as cleared (markReconciled) themselves.
 */
@Injectable()
export class ReconciliationService {
  async list(tx: Prisma.TransactionClient, companyId: string, cashBankAccountId: string) {
    const cashBankAccount = await tx.cashBankAccount.findFirst({ where: { id: cashBankAccountId, companyId } });
    if (!cashBankAccount) throw new NotFoundException("Cash/bank account not found");
    return tx.bankReconciliation.findMany({ where: { companyId, cashBankAccountId }, orderBy: { statementDate: "desc" } });
  }

  async run(tx: Prisma.TransactionClient, companyId: string, input: RunReconciliationInput) {
    const cashBankAccount = await tx.cashBankAccount.findFirst({ where: { id: input.cashBankAccountId, companyId } });
    if (!cashBankAccount) throw new NotFoundException("Cash/bank account not found");

    const statementBalance = new Decimal(input.statementBalance);

    const lines = await tx.journalEntryLine.findMany({
      where: {
        accountId: cashBankAccount.accountId,
        journalEntry: { companyId, status: { in: LEDGER_STATUSES }, entryDate: { lte: input.statementDate } },
      },
    });
    let bookBalance = new Decimal(0);
    for (const line of lines) {
      bookBalance = bookBalance.plus(line.debit.toString()).minus(line.credit.toString());
    }

    const difference = statementBalance.minus(bookBalance);

    return tx.bankReconciliation.create({
      data: {
        companyId,
        cashBankAccountId: input.cashBankAccountId,
        statementDate: input.statementDate,
        statementBalance: statementBalance.toFixed(4),
        bookBalance: bookBalance.toFixed(4),
        difference: difference.toFixed(4),
      },
    });
  }

  /** Everything posted against this account, on or before a date, that
   * hasn't yet been marked cleared against a bank statement. */
  async listUnreconciled(tx: Prisma.TransactionClient, companyId: string, cashBankAccountId: string, asOfDate: Date) {
    const cashBankAccount = await tx.cashBankAccount.findFirst({ where: { id: cashBankAccountId, companyId } });
    if (!cashBankAccount) throw new NotFoundException("Cash/bank account not found");

    const [receipts, payments, transfersOut, transfersIn] = await Promise.all([
      tx.receiptVoucher.findMany({
        where: { companyId, cashBankAccountId, status: VoucherStatus.POSTED, reconciledAt: null, voucherDate: { lte: asOfDate } },
      }),
      tx.paymentVoucher.findMany({
        where: { companyId, cashBankAccountId, status: VoucherStatus.POSTED, reconciledAt: null, voucherDate: { lte: asOfDate } },
      }),
      tx.bankTransfer.findMany({
        where: { companyId, fromAccountId: cashBankAccountId, status: VoucherStatus.POSTED, reconciledAt: null, transferDate: { lte: asOfDate } },
      }),
      tx.bankTransfer.findMany({
        where: { companyId, toAccountId: cashBankAccountId, status: VoucherStatus.POSTED, reconciledAt: null, transferDate: { lte: asOfDate } },
      }),
    ]);

    return { receipts, payments, transfersOut, transfersIn };
  }

  async markReconciled(tx: Prisma.TransactionClient, companyId: string, input: MarkReconciledInput) {
    const now = new Date();
    if (input.receiptVoucherIds?.length) {
      await tx.receiptVoucher.updateMany({ where: { id: { in: input.receiptVoucherIds }, companyId }, data: { reconciledAt: now } });
    }
    if (input.paymentVoucherIds?.length) {
      await tx.paymentVoucher.updateMany({ where: { id: { in: input.paymentVoucherIds }, companyId }, data: { reconciledAt: now } });
    }
    if (input.bankTransferIds?.length) {
      await tx.bankTransfer.updateMany({ where: { id: { in: input.bankTransferIds }, companyId }, data: { reconciledAt: now } });
    }
    return { reconciled: true };
  }
}
