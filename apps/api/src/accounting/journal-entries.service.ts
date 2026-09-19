import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalEntryStatus, JournalSourceType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { FiscalService } from "./fiscal.service";
import { AccountsService } from "./accounts.service";
import { NumberingService } from "./numbering.service";

export interface PostingLineInput {
  accountId: string;
  costCenterId?: string | null;
  debit?: string;
  credit?: string;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryDate: Date;
  description?: string;
  branchId?: string | null;
  sourceType?: JournalSourceType;
  sourceId?: string;
  lines: PostingLineInput[];
}

/**
 * The ONLY code path in the application allowed to write journal_entries /
 * journal_entry_lines (see docs/ARCHITECTURE.md §5 — the PostingEngine).
 * Every other module that needs an accounting effect (sales invoices,
 * payroll, depreciation, ...) must go through createDraft()/post() here
 * rather than touching those tables directly.
 *
 * The application-level balance check below is a courtesy — it exists so a
 * caller gets an immediate, readable 400 error instead of a raw Postgres
 * trigger exception. It is NOT the real guarantee: the database's own
 * deferred CONSTRAINT TRIGGER (journal_entry_lines_balance_check, added in
 * the add_row_level_security migration) is what actually makes an
 * unbalanced entry impossible to commit, independent of any bug here.
 */
@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly fiscalService: FiscalService,
    private readonly accountsService: AccountsService,
    private readonly numberingService: NumberingService,
  ) {}

  async createDraft(tx: Prisma.TransactionClient, companyId: string, userId: string, input: CreateJournalEntryInput) {
    if (input.lines.length < 2) {
      throw new BadRequestException("A journal entry needs at least two lines");
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    for (const line of input.lines) {
      const debit = new Decimal(line.debit ?? 0);
      const credit = new Decimal(line.credit ?? 0);
      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException("Debit/credit amounts cannot be negative");
      }
      if (!debit.isZero() && !credit.isZero()) {
        throw new BadRequestException("A line cannot have both a debit and a credit amount");
      }
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException("A line must have either a debit or a credit amount");
      }
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      await this.accountsService.requirePostable(tx, companyId, line.accountId);
      if (line.costCenterId) {
        const costCenter = await tx.costCenter.findFirst({ where: { id: line.costCenterId, companyId } });
        if (!costCenter) throw new BadRequestException(`Cost center ${line.costCenterId} not found in this company`);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is not balanced: total debit ${totalDebit.toFixed(4)} ≠ total credit ${totalCredit.toFixed(4)}`,
      );
    }

    const period = await this.fiscalService.requireOpenPeriodForDate(tx, companyId, input.entryDate);
    const entryNumber = await this.numberingService.next(
      tx,
      companyId,
      input.branchId ?? null,
      "JOURNAL_VOUCHER",
      input.entryDate,
    );

    return tx.journalEntry.create({
      data: {
        companyId,
        branchId: input.branchId ?? null,
        periodId: period.id,
        entryNumber,
        entryDate: input.entryDate,
        sourceType: input.sourceType ?? JournalSourceType.MANUAL,
        sourceId: input.sourceId,
        description: input.description,
        status: JournalEntryStatus.DRAFT,
        createdById: userId,
        lines: {
          create: input.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            costCenterId: line.costCenterId ?? null,
            debit: new Decimal(line.debit ?? 0).toFixed(4),
            credit: new Decimal(line.credit ?? 0).toFixed(4),
            description: line.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, journalEntryId: string) {
    const entry = await tx.journalEntry.findFirst({ where: { id: journalEntryId, companyId } });
    if (!entry) throw new NotFoundException("Journal entry not found");
    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException(`Entry ${entry.entryNumber} is already ${entry.status.toLowerCase()}`);
    }
    // Re-check: the period could have been closed between draft creation and posting.
    await this.fiscalService.requireOpenPeriodForDate(tx, companyId, entry.entryDate);

    return tx.journalEntry.update({
      where: { id: journalEntryId },
      data: { status: JournalEntryStatus.POSTED, postedById: userId, postedAt: new Date() },
      include: { lines: { include: { account: true } } },
    });
  }

  async reverse(tx: Prisma.TransactionClient, companyId: string, userId: string, journalEntryId: string, reversalDate?: Date) {
    const original = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException("Journal entry not found");
    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException(`Only a posted entry can be reversed (this one is ${original.status.toLowerCase()})`);
    }

    const date = reversalDate ?? new Date();
    const period = await this.fiscalService.requireOpenPeriodForDate(tx, companyId, date);
    const entryNumber = await this.numberingService.next(tx, companyId, original.branchId, "JOURNAL_VOUCHER", date);

    const reversal = await tx.journalEntry.create({
      data: {
        companyId,
        branchId: original.branchId,
        periodId: period.id,
        entryNumber,
        entryDate: date,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        description: `Reversal of ${original.entryNumber}`,
        status: JournalEntryStatus.POSTED,
        reversalOfId: original.id,
        createdById: userId,
        postedById: userId,
        postedAt: new Date(),
        lines: {
          create: original.lines.map((line) => ({
            lineNumber: line.lineNumber,
            accountId: line.accountId,
            costCenterId: line.costCenterId,
            // Flip debit <-> credit: that's what a reversal is.
            debit: line.credit,
            credit: line.debit,
            description: line.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    await tx.journalEntry.update({ where: { id: original.id }, data: { status: JournalEntryStatus.REVERSED } });

    return reversal;
  }

  async get(tx: Prisma.TransactionClient, companyId: string, journalEntryId: string) {
    const entry = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
      include: { lines: { include: { account: true, costCenter: true } } },
    });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return entry;
  }

  async list(tx: Prisma.TransactionClient, companyId: string, status?: JournalEntryStatus) {
    return tx.journalEntry.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { entryDate: "desc" },
      include: { lines: true },
    });
  }
}
