import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, VoucherPartyType, VoucherStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";
import { NumberingService } from "../accounting/numbering.service";

export interface CreateReceiptVoucherInput {
  cashBankAccountId: string;
  voucherDate: Date;
  branchId?: string;
  partyType: VoucherPartyType;
  customerId?: string;
  supplierId?: string;
  otherAccountId?: string;
  amount: string;
  description?: string;
}

/**
 * Money coming in. Against a CUSTOMER it clears that customer's AR
 * balance; against a SUPPLIER (a refund) it clears whatever debit
 * balance sits in their AP account; OTHER credits whichever account the
 * caller names (misc income, capital injection). Two-step like
 * Sales/Purchase invoices: create() drafts it, post() commits the GL
 * effect — never a bare balance change with no traceable entry.
 */
@Injectable()
export class ReceiptVouchersService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly numberingService: NumberingService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.receiptVoucher.findMany({
      where: { companyId },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
      orderBy: { voucherDate: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const voucher = await tx.receiptVoucher.findFirst({
      where: { id, companyId },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
    });
    if (!voucher) throw new NotFoundException("Receipt voucher not found");
    return voucher;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateReceiptVoucherInput) {
    const cashBankAccount = await tx.cashBankAccount.findFirst({ where: { id: input.cashBankAccountId, companyId } });
    if (!cashBankAccount) throw new NotFoundException("Cash/bank account not found");

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException("amount must be greater than zero");

    if (input.partyType === VoucherPartyType.CUSTOMER) {
      if (!input.customerId) throw new BadRequestException("customerId is required when partyType is CUSTOMER");
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, companyId } });
      if (!customer) throw new NotFoundException("Customer not found");
    } else if (input.partyType === VoucherPartyType.SUPPLIER) {
      if (!input.supplierId) throw new BadRequestException("supplierId is required when partyType is SUPPLIER");
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId } });
      if (!supplier) throw new NotFoundException("Supplier not found");
    } else {
      if (!input.otherAccountId) throw new BadRequestException("otherAccountId is required when partyType is OTHER");
      await this.accountsService.requirePostable(tx, companyId, input.otherAccountId);
    }

    const voucherNumber = await this.numberingService.next(
      tx,
      companyId,
      input.branchId ?? null,
      "RECEIPT_VOUCHER",
      input.voucherDate,
    );

    return tx.receiptVoucher.create({
      data: {
        companyId,
        branchId: input.branchId,
        voucherNumber,
        voucherDate: input.voucherDate,
        cashBankAccountId: input.cashBankAccountId,
        partyType: input.partyType,
        customerId: input.partyType === VoucherPartyType.CUSTOMER ? input.customerId : undefined,
        supplierId: input.partyType === VoucherPartyType.SUPPLIER ? input.supplierId : undefined,
        otherAccountId: input.partyType === VoucherPartyType.OTHER ? input.otherAccountId : undefined,
        amount: amount.toFixed(4),
        description: input.description,
        status: VoucherStatus.DRAFT,
      },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, voucherId: string) {
    const voucher = await tx.receiptVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: { cashBankAccount: true, customer: true, supplier: true },
    });
    if (!voucher) throw new NotFoundException("Receipt voucher not found");
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(`Voucher ${voucher.voucherNumber} is already ${voucher.status.toLowerCase()}`);
    }

    let creditAccountId: string;
    if (voucher.partyType === VoucherPartyType.CUSTOMER) {
      creditAccountId =
        voucher.customer!.arAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AR"));
    } else if (voucher.partyType === VoucherPartyType.SUPPLIER) {
      creditAccountId =
        voucher.supplier!.apAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AP"));
    } else {
      creditAccountId = voucher.otherAccountId!;
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: voucher.voucherDate,
      description: `Receipt Voucher ${voucher.voucherNumber}`,
      branchId: voucher.branchId,
      sourceType: JournalSourceType.RECEIPT_VOUCHER,
      sourceId: voucher.id,
      lines: [
        { accountId: voucher.cashBankAccount.accountId, debit: voucher.amount.toString() },
        { accountId: creditAccountId, credit: voucher.amount.toString() },
      ],
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.receiptVoucher.update({
      where: { id: voucher.id },
      data: { status: VoucherStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
    });
  }
}
