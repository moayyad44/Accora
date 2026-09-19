import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceKind, JournalSourceType, Prisma, SalesDocStatus, StockMoveSourceType } from "@prisma/client";
import Decimal from "decimal.js";
import { NumberingService } from "../accounting/numbering.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";
import { InventoryService } from "../inventory/inventory.service";
import { SerialTrackingService } from "../inventory/serial-tracking.service";

export interface SalesInvoiceLineInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  unitPrice: string;
  discountAmount?: string;
  description?: string;
  /** Required when the item's trackingType is SERIAL — the specific units
   * to ship; length must equal qty. */
  serialNumbers?: string[];
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
 * A sales invoice's GL effect (see docs/ARCHITECTURE.md §35), all in one
 * journal entry:
 *   DR Accounts Receivable (customer override, else company DEFAULT_AR)  = total
 *   CR Sales Revenue (company DEFAULT_SALES_REVENUE)                      = subtotal
 *   DR Cost of Goods Sold (company DEFAULT_COGS)                          = actual cost of what shipped
 *   CR Inventory (company DEFAULT_INVENTORY)                              = actual cost of what shipped
 * The COGS amount is not a guess or a formula on the sale price — it's
 * exactly what InventoryService.issueStock() reports it actually cost to
 * fulfil this line (FIFO: the real layers consumed; weighted average: the
 * item's current average), which is also what physically leaves the
 * warehouse. Selling more than is on hand is rejected before either the
 * stock or the GL is touched (issueStock throws, rolling back the whole
 * posting transaction).
 */
@Injectable()
export class SalesInvoicesService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly inventoryService: InventoryService,
    private readonly serialTrackingService: SerialTrackingService,
  ) {}

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateSalesInvoiceInput) {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!customer) throw new NotFoundException("Customer not found");
    if (input.lines.length === 0) throw new BadRequestException("Invoice needs at least one line");

    let subtotal = new Decimal(0);
    const lineData: {
      lineNumber: number;
      itemId: string;
      warehouseId: string;
      qty: string;
      unitPrice: string;
      discountAmount: string;
      lineTotal: string;
      description?: string;
      serialNumbers: string[];
    }[] = [];

    for (const [index, line] of input.lines.entries()) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, companyId } });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);
      const warehouse = await tx.warehouse.findFirst({ where: { id: line.warehouseId, companyId } });
      if (!warehouse) throw new NotFoundException(`Warehouse ${line.warehouseId} not found`);
      if (item.trackingType === "SERIAL" && (line.serialNumbers?.length ?? 0) !== Number(line.qty)) {
        throw new BadRequestException(
          `Item ${item.sku} is serial-tracked — provide exactly ${line.qty} serial number(s) on this line`,
        );
      }

      const qty = new Decimal(line.qty);
      const unitPrice = new Decimal(line.unitPrice);
      const discount = new Decimal(line.discountAmount ?? 0);
      if (qty.lte(0)) throw new BadRequestException("Line qty must be greater than zero");
      const lineTotal = qty.times(unitPrice).minus(discount);
      subtotal = subtotal.plus(lineTotal);

      lineData.push({
        lineNumber: index + 1,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: qty.toFixed(4),
        unitPrice: unitPrice.toFixed(4),
        discountAmount: discount.toFixed(4),
        lineTotal: lineTotal.toFixed(4),
        description: line.description,
        serialNumbers: line.serialNumbers ?? [],
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

    // Ship the goods (or fail the whole posting if any line oversells) and
    // find out what it actually cost, before touching the GL at all.
    let totalCogs = new Decimal(0);
    for (const line of invoice.lines) {
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
      const issued =
        item.trackingType === "SERIAL"
          ? await this.serialTrackingService.issue(tx, companyId, {
              itemId: line.itemId,
              warehouseId: line.warehouseId!,
              serialNumbers: line.serialNumbers,
              sourceType: StockMoveSourceType.SALES_INVOICE,
              sourceId: invoice.id,
              moveDate: invoice.invoiceDate,
            })
          : await this.inventoryService.issueStock(tx, companyId, {
              itemId: line.itemId,
              warehouseId: line.warehouseId!,
              qty: line.qty.toString(),
              sourceType: StockMoveSourceType.SALES_INVOICE,
              sourceId: invoice.id,
              moveDate: invoice.invoiceDate,
            });
      totalCogs = totalCogs.plus(issued.totalCost);
      await tx.salesInvoiceLine.update({ where: { id: line.id }, data: { unitCost: issued.unitCost } });
    }

    if (totalCogs.gt(0)) {
      const cogsAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_COGS");
      const inventoryAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_INVENTORY");
      lines.push({ accountId: cogsAccountId, debit: totalCogs.toFixed(4) });
      lines.push({ accountId: inventoryAccountId, credit: totalCogs.toFixed(4) });
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
