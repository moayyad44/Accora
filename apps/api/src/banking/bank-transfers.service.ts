import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, VoucherStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { JournalEntriesService } from "../accounting/journal-entries.service";
import { NumberingService } from "../accounting/numbering.service";

export interface CreateBankTransferInput {
  fromAccountId: string;
  toAccountId: string;
  transferDate: Date;
  amount: string;
  description?: string;
}

/**
 * Moves money between two of the company's own cash/bank accounts —
 * never touches AR/AP, just debits the destination's GL account and
 * credits the source's. Two-step like vouchers: create() drafts it,
 * post() commits the GL effect.
 */
@Injectable()
export class BankTransfersService {
  constructor(
    private readonly journalEntriesService: JournalEntriesService,
    private readonly numberingService: NumberingService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.bankTransfer.findMany({
      where: { companyId },
      include: { fromAccount: true, toAccount: true },
      orderBy: { transferDate: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const transfer = await tx.bankTransfer.findFirst({
      where: { id, companyId },
      include: { fromAccount: true, toAccount: true },
    });
    if (!transfer) throw new NotFoundException("Bank transfer not found");
    return transfer;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateBankTransferInput) {
    if (input.fromAccountId === input.toAccountId) {
      throw new BadRequestException("fromAccountId and toAccountId must be different");
    }
    const fromAccount = await tx.cashBankAccount.findFirst({ where: { id: input.fromAccountId, companyId } });
    if (!fromAccount) throw new NotFoundException("Source cash/bank account not found");
    const toAccount = await tx.cashBankAccount.findFirst({ where: { id: input.toAccountId, companyId } });
    if (!toAccount) throw new NotFoundException("Destination cash/bank account not found");

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException("amount must be greater than zero");

    const transferNumber = await this.numberingService.next(tx, companyId, null, "BANK_TRANSFER", input.transferDate);

    return tx.bankTransfer.create({
      data: {
        companyId,
        transferNumber,
        transferDate: input.transferDate,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: amount.toFixed(4),
        description: input.description,
        status: VoucherStatus.DRAFT,
      },
      include: { fromAccount: true, toAccount: true },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, transferId: string) {
    const transfer = await tx.bankTransfer.findFirst({
      where: { id: transferId, companyId },
      include: { fromAccount: true, toAccount: true },
    });
    if (!transfer) throw new NotFoundException("Bank transfer not found");
    if (transfer.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(`Transfer ${transfer.transferNumber} is already ${transfer.status.toLowerCase()}`);
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: transfer.transferDate,
      description: `Bank Transfer ${transfer.transferNumber}: ${transfer.fromAccount.name} -> ${transfer.toAccount.name}`,
      sourceType: JournalSourceType.BANK_TRANSFER,
      sourceId: transfer.id,
      lines: [
        { accountId: transfer.toAccount.accountId, debit: transfer.amount.toString() },
        { accountId: transfer.fromAccount.accountId, credit: transfer.amount.toString() },
      ],
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.bankTransfer.update({
      where: { id: transfer.id },
      data: { status: VoucherStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { fromAccount: true, toAccount: true },
    });
  }
}
