import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceKind, JournalSourceType, Prisma, SalesDocStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { NumberingService } from "../accounting/numbering.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";

export interface SalesInvoiceLineInput {
  itemId: string;
  qty: string;
  unitPrice: string;
  discountAmount?: string;
  description?: string;
}

export interface CreateSalesInvoiceInput {
  customerId: string;
  invoiceDate: Date;
  dueDate?: Date;
  kind?: InvoiceKind;
  branchId?: string | null;
  lines: SalesInvoiceLineInput[];
}

/**
 * A sales invoice's GL effect (see docs/ARCHITECTURE.md §35):
 *   DR Accounts Receivable (customer override, else company DEFAULT_AR)
 *   CR Sales Revenue (company DEFAULT_SALES_REVENUE)
 * Inventory/COGS is intentionally NOT booked here yet — that requires an
 * actual stock ledger with a known unit cost, which is Phase 6. Phase 5's
 * job is the money side of invoicing; Phase 6 adds the physical side on
 * top of the same SalesInvoiceLine.itemId already captured here.
 */
@Injectable()
export class SalesInvoicesService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateSalesInvoiceInput) {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!customer) throw new NotFoundException("Customer not found");
    if (input.lines.length === 0) throw new BadRequestException("Invoice needs at least one line");

    let subtotal = new Decimal(0);
    const lineData: {
      lineNumber: number;
      itemId: string;
      qty: string;
      unitPrice: string;
      discountAmount: string;
      lineTotal: string;
      description?: string;
    }[] = [];

    for (const [index, line] of input.lines.entries()) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, companyId } });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);

      const qty = new Decimal(line.qty);
      const unitPrice = new Decimal(line.unitPrice);
      const discount = new Decimal(line.discountAmount ?? 0);
      if (qty.lte(0)) throw new BadRequestException("Line qty must be greater than zero");
      const lineTotal = qty.times(unitPrice).minus(discount);
      subtotal = subtotal.plus(lineTotal);

      lineData.push({
        lineNumber: index + 1,
        itemId: line.itemId,
        qty: qty.toFixed(4),
        unitPrice: unitPrice.toFixed(4),
        discountAmount: discount.toFixed(4),
        lineTotal: lineTotal.toFixed(4),
        description: line.description,
      });
    }

    // Phase 5 simplification: no tax engine wiring yet (see docs/SALES_PURCHASING.md).
    const taxTotal = new Decimal(0);
    const total = subtotal.plus(taxTotal);

    const invoiceNumber = await this.numberingService.next(
      tx,
      companyId,
      input.branchId ?? null,
      "SALES_INVOICE",
      input.invoiceDate,
    );

    return tx.salesInvoice.create({
      data: {
        companyId,
        branchId: input.branchId ?? null,
        customerId: input.customerId,
        invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        kind: input.kind ?? InvoiceKind.CREDIT,
        status: SalesDocStatus.DRAFT,
        currencyId: (await tx.companySetting.findUniqueOrThrow({ where: { companyId } })).baseCurrencyId,
        subtotal: subtotal.toFixed(4),
        taxTotal: taxTotal.toFixed(4),
        total: total.toFixed(4),
        lines: { create: lineData },
      },
      include: { lines: true, customer: true },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, invoiceId: string) {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, lines: true },
    });
    if (!invoice) throw new NotFoundException("Sales invoice not found");
    if (invoice.status !== SalesDocStatus.DRAFT) {
      throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is already ${invoice.status.toLowerCase()}`);
    }

    const arAccountId =
      invoice.customer.arAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AR"));
    const revenueAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_SALES_REVENUE");

    const lines = [
      { accountId: arAccountId, debit: invoice.total.toString() },
      { accountId: revenueAccountId, credit: invoice.subtotal.toString() },
    ];
    if (new Decimal(invoice.taxTotal.toString()).gt(0)) {
      const taxAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_TAX_PAYABLE");
      lines.push({ accountId: taxAccountId, credit: invoice.taxTotal.toString() });
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: invoice.invoiceDate,
      description: `Sales Invoice ${invoice.invoiceNumber}`,
      branchId: invoice.branchId,
      sourceType: JournalSourceType.SALES_INVOICE,
      sourceId: invoice.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { status: SalesDocStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { lines: true, customer: true },
    });
  }

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.salesInvoice.findMany({
      where: { companyId },
      orderBy: { invoiceDate: "desc" },
      include: { customer: true, lines: true },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, invoiceId: string) {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, lines: { include: { item: true } } },
    });
    if (!invoice) throw new NotFoundException("Sales invoice not found");
    return invoice;
  }
}
