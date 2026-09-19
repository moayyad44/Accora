import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, PurchaseDocStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { NumberingService } from "../accounting/numbering.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";

export interface PurchaseInvoiceLineInput {
  itemId: string;
  qty: string;
  unitCost: string;
  description?: string;
}

export interface CreatePurchaseInvoiceInput {
  supplierId: string;
  invoiceDate: Date;
  dueDate?: Date;
  branchId?: string | null;
  lines: PurchaseInvoiceLineInput[];
}

/**
 * A purchase invoice's GL effect (see docs/ARCHITECTURE.md §35):
 *   DR Inventory (company DEFAULT_INVENTORY — every item is treated as
 *      stock for Phase 5's accounting purposes; Phase 6 adds the matching
 *      physical stock-quantity ledger on top of the same item)
 *   CR Accounts Payable (supplier override, else company DEFAULT_AP)
 * Landed costs (shipping/clearance/other) are captured on the schema
 * (PurchaseInvoice.shippingCost etc.) but their allocation into item unit
 * cost is a Phase 6 concern once there is an actual unit-cost ledger to
 * allocate into — not booked here yet.
 */
@Injectable()
export class PurchaseInvoicesService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreatePurchaseInvoiceInput) {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    if (input.lines.length === 0) throw new BadRequestException("Invoice needs at least one line");

    let subtotal = new Decimal(0);
    const lineData: {
      lineNumber: number;
      itemId: string;
      qty: string;
      unitCost: string;
      lineTotal: string;
    }[] = [];

    for (const [index, line] of input.lines.entries()) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, companyId } });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);

      const qty = new Decimal(line.qty);
      const unitCost = new Decimal(line.unitCost);
      if (qty.lte(0)) throw new BadRequestException("Line qty must be greater than zero");
      const lineTotal = qty.times(unitCost);
      subtotal = subtotal.plus(lineTotal);

      lineData.push({
        lineNumber: index + 1,
        itemId: line.itemId,
        qty: qty.toFixed(4),
        unitCost: unitCost.toFixed(4),
        lineTotal: lineTotal.toFixed(4),
      });
    }

    const taxTotal = new Decimal(0); // Phase 5 simplification, see docs/SALES_PURCHASING.md
    const total = subtotal.plus(taxTotal);

    const invoiceNumber = await this.numberingService.next(
      tx,
      companyId,
      input.branchId ?? null,
      "PURCHASE_INVOICE",
      input.invoiceDate,
    );

    return tx.purchaseInvoice.create({
      data: {
        companyId,
        branchId: input.branchId ?? null,
        supplierId: input.supplierId,
        invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        status: PurchaseDocStatus.DRAFT,
        currencyId: (await tx.companySetting.findUniqueOrThrow({ where: { companyId } })).baseCurrencyId,
        subtotal: subtotal.toFixed(4),
        taxTotal: taxTotal.toFixed(4),
        total: total.toFixed(4),
        lines: { create: lineData },
      },
      include: { lines: true, supplier: true },
    });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, invoiceId: string) {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { supplier: true, lines: true },
    });
    if (!invoice) throw new NotFoundException("Purchase invoice not found");
    if (invoice.status !== PurchaseDocStatus.DRAFT) {
      throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is already ${invoice.status.toLowerCase()}`);
    }

    const apAccountId =
      invoice.supplier.apAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AP"));
    const inventoryAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_INVENTORY");

    // taxTotal is always 0 for now (see create() above — Phase 5 has no tax
    // engine wiring yet), so this only ever produces the two base lines.
    // When purchase tax is wired in, it needs its own recoverable/input-tax
    // account (distinct from DEFAULT_TAX_PAYABLE, which is sales output
    // tax owed to the government) — deferred rather than guessed at here.
    const lines = [
      { accountId: inventoryAccountId, debit: invoice.subtotal.toString() },
      { accountId: apAccountId, credit: invoice.total.toString() },
    ];

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: invoice.invoiceDate,
      description: `Purchase Invoice ${invoice.invoiceNumber}`,
      branchId: invoice.branchId,
      sourceType: JournalSourceType.PURCHASE_INVOICE,
      sourceId: invoice.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: PurchaseDocStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { lines: true, supplier: true },
    });
  }

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.purchaseInvoice.findMany({
      where: { companyId },
      orderBy: { invoiceDate: "desc" },
      include: { supplier: true, lines: true },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, invoiceId: string) {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { supplier: true, lines: { include: { item: true } } },
    });
    if (!invoice) throw new NotFoundException("Purchase invoice not found");
    return invoice;
  }
}
