import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, VoucherPartyType, VoucherStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";
import { NumberingService } from "../accounting/numbering.service";

export interface CreatePaymentVoucherInput {
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
 * Money going out. Against a SUPPLIER it clears that supplier's AP
 * balance; against a CUSTOMER (a refund) it clears whatever credit
 * balance sits in their AR account; OTHER debits whichever account the
 * caller names (an expense paid directly from cash/bank, owner
 * drawings). Mirrors ReceiptVouchersService exactly, opposite direction.
 */
@Injectable()
export class PaymentVouchersService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly numberingService: NumberingService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.paymentVoucher.findMany({
      where: { companyId },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
      orderBy: { voucherDate: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const voucher = await tx.paymentVoucher.findFirst({
      where: { id, companyId },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
    });
    if (!voucher) throw new NotFoundException("Payment voucher not found");
    return voucher;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreatePaymentVoucherInput) {
    const cashBankAccount = await tx.cashBankAccount.findFirst({ where: { id: input.cashBankAccountId, companyId } });
    if (!cashBankAccount) throw new NotFoundException("Cash/bank account not found");

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException("amount must be greater than zero");

    if (input.partyType === VoucherPartyType.SUPPLIER) {
      if (!input.supplierId) throw new BadRequestException("supplierId is required when partyType is SUPPLIER");
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId } });
      if (!supplier) throw new NotFoundException("Supplier not found");
    } else if (input.partyType === VoucherPartyType.CUSTOMER) {
      if (!input.customerId) throw new BadRequestException("customerId is required when partyType is CUSTOMER");
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, companyId } });
      if (!customer) throw new NotFoundException("Customer not found");
    } else {
      if (!input.otherAccountId) throw new BadRequestException("otherAccountId is required when partyType is OTHER");
      await this.accountsService.requirePostable(tx, companyId, input.otherAccountId);
    }

    const voucherNumber = await this.numberingService.next(
      tx,
      companyId,
      input.branchId ?? null,
      "PAYMENT_VOUCHER",
      input.voucherDate,
    );

    return tx.paymentVoucher.create({
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
    const voucher = await tx.paymentVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: { cashBankAccount: true, customer: true, supplier: true },
    });
    if (!voucher) throw new NotFoundException("Payment voucher not found");
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(`Voucher ${voucher.voucherNumber} is already ${voucher.status.toLowerCase()}`);
    }

    let debitAccountId: string;
    if (voucher.partyType === VoucherPartyType.SUPPLIER) {
      debitAccountId =
        voucher.supplier!.apAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AP"));
    } else if (voucher.partyType === VoucherPartyType.CUSTOMER) {
      debitAccountId =
        voucher.customer!.arAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AR"));
    } else {
      debitAccountId = voucher.otherAccountId!;
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: voucher.voucherDate,
      description: `Payment Voucher ${voucher.voucherNumber}`,
      branchId: voucher.branchId,
      sourceType: JournalSourceType.PAYMENT_VOUCHER,
      sourceId: voucher.id,
      lines: [
        { accountId: debitAccountId, debit: voucher.amount.toString() },
        { accountId: voucher.cashBankAccount.accountId, credit: voucher.amount.toString() },
      ],
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.paymentVoucher.update({
      where: { id: voucher.id },
      data: { status: VoucherStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { cashBankAccount: true, customer: true, supplier: true, otherAccount: true },
    });
  }
}
