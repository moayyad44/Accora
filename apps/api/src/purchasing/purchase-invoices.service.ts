import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma, PurchaseDocStatus, StockMoveSourceType } from "@prisma/client";
import Decimal from "decimal.js";
import { NumberingService } from "../accounting/numbering.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService, PostingLineInput } from "../accounting/journal-entries.service";
import { InventoryService } from "../inventory/inventory.service";
import { SerialTrackingService } from "../inventory/serial-tracking.service";
import { TaxGroupsService } from "../tax/tax-groups.service";
import { ApprovalService } from "../approvals/approval.service";

export interface PurchaseInvoiceLineInput {
  itemId: string;
  warehouseId: string;
  qty: string;
  unitCost: string;
  description?: string;
  /** Required when the item's trackingType is BATCH. */
  batchNumber?: string;
  expiryDate?: Date;
  /** Required when the item's trackingType is SERIAL — length must equal qty. */
  serialNumbers?: string[];
  /** Optional — when set, tax is computed from this group's active rates
   * as of invoiceDate and locked in at draft creation. A purchase-side
   * group would typically map its rates to a recoverable input-tax asset
   * account rather than the payable liability a sales-side group uses —
   * TaxRate.payableAccountId is just any account the company chooses, so
   * both directions are the same mechanism (docs/TAX.md). */
  taxGroupId?: string;
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
 * Posting also physically receives the goods into the chosen warehouse via
 * InventoryService.receiveStock — the invoice line's unitCost becomes that
 * stock's cost basis (a FIFO layer, or folded into the item's weighted
 * average), so what Sales later books as COGS traces back to what was
 * actually paid here.
 *
 * Landed costs (shipping/clearance/other) are captured on the schema
 * (PurchaseInvoice.shippingCost etc.) but their allocation into item unit
 * cost is deferred — not booked here yet.
 */
@Injectable()
export class PurchaseInvoicesService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly inventoryService: InventoryService,
    private readonly serialTrackingService: SerialTrackingService,
    private readonly taxGroupsService: TaxGroupsService,
    private readonly approvalService: ApprovalService,
  ) {}

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreatePurchaseInvoiceInput) {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    if (input.lines.length === 0) throw new BadRequestException("Invoice needs at least one line");

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    const lineData: {
      lineNumber: number;
      itemId: string;
      warehouseId: string;
      qty: string;
      unitCost: string;
      lineTotal: string;
      batchNumber?: string;
      expiryDate?: Date;
      serialNumbers: string[];
      taxGroupId?: string;
      taxAmount: string;
      taxBreakdown: { taxRateId: string; amount: string }[];
    }[] = [];

    for (const [index, line] of input.lines.entries()) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, companyId } });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);
      const warehouse = await tx.warehouse.findFirst({ where: { id: line.warehouseId, companyId } });
      if (!warehouse) throw new NotFoundException(`Warehouse ${line.warehouseId} not found`);
      if (item.trackingType === "BATCH" && !line.batchNumber) {
        throw new BadRequestException(`Item ${item.sku} is batch-tracked — batchNumber is required on this line`);
      }
      if (item.trackingType === "SERIAL" && (line.serialNumbers?.length ?? 0) !== Number(line.qty)) {
        throw new BadRequestException(
          `Item ${item.sku} is serial-tracked — provide exactly ${line.qty} serial number(s) on this line`,
        );
      }

      const qty = new Decimal(line.qty);
      const unitCost = new Decimal(line.unitCost);
      if (qty.lte(0)) throw new BadRequestException("Line qty must be greater than zero");
      const lineTotal = qty.times(unitCost);
      subtotal = subtotal.plus(lineTotal);

      let lineTaxAmount = new Decimal(0);
      let taxBreakdown: { taxRateId: string; amount: string }[] = [];
      if (line.taxGroupId) {
        const computed = await this.taxGroupsService.computeTax(tx, companyId, line.taxGroupId, lineTotal, input.invoiceDate);
        lineTaxAmount = computed.totalTax;
        taxBreakdown = computed.breakdown.map((b) => ({ taxRateId: b.taxRateId, amount: b.amount }));
      }
      taxTotal = taxTotal.plus(lineTaxAmount);

      lineData.push({
        lineNumber: index + 1,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: qty.toFixed(4),
        unitCost: unitCost.toFixed(4),
        lineTotal: lineTotal.toFixed(4),
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate,
        serialNumbers: line.serialNumbers ?? [],
        taxGroupId: line.taxGroupId,
        taxAmount: lineTaxAmount.toFixed(4),
        taxBreakdown,
      });
    }

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
        lines: {
          create: lineData.map(({ taxBreakdown, ...line }) => ({
            ...line,
            taxBreakdown: { create: taxBreakdown },
          })),
        },
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

    // If the company has configured an approval workflow for
    // PURCHASE_INVOICE (e.g. "over 5000 needs manager sign-off"), it must
    // already be APPROVED before anything below touches the ledger or
    // stock. A company with no such workflow configured sees no change at
    // all — this is opt-in, not a default gate on every invoice.
    await this.approvalService.checkApproved(tx, companyId, "PURCHASE_INVOICE", invoice.id, new Decimal(invoice.total.toString()));

    const apAccountId =
      invoice.supplier.apAccountId ?? (await this.accountMappingsService.require(tx, companyId, "DEFAULT_AP"));
    const inventoryAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_INVENTORY");

    const lines: PostingLineInput[] = [
      { accountId: inventoryAccountId, debit: invoice.subtotal.toString() },
      { accountId: apAccountId, credit: invoice.total.toString() },
    ];

    // Each tax rate applied across this invoice's lines debits its own
    // account (typically a recoverable input-tax asset, distinct from
    // DEFAULT_TAX_PAYABLE which is sales-side output tax owed to the
    // government) — aggregated the same way sales does, one GL line per
    // account even when several lines share a rate.
    const lineTaxes = await tx.purchaseInvoiceLineTax.findMany({
      where: { purchaseInvoiceLine: { purchaseInvoiceId: invoice.id } },
      include: { taxRate: true },
    });
    const taxByAccount = new Map<string, Decimal>();
    for (const lt of lineTaxes) {
      const key = lt.taxRate.payableAccountId;
      taxByAccount.set(key, (taxByAccount.get(key) ?? new Decimal(0)).plus(new Decimal(lt.amount.toString())));
    }
    for (const [accountId, amount] of taxByAccount) {
      if (amount.lte(0)) continue;
      lines.push({ accountId, debit: amount.toFixed(4) });
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: invoice.invoiceDate,
      description: `Purchase Invoice ${invoice.invoiceNumber}`,
      branchId: invoice.branchId,
      sourceType: JournalSourceType.PURCHASE_INVOICE,
      sourceId: invoice.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    for (const line of invoice.lines) {
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
      if (item.trackingType === "SERIAL") {
        await this.serialTrackingService.receive(tx, companyId, {
          itemId: line.itemId,
          warehouseId: line.warehouseId!,
          serialNumbers: line.serialNumbers,
          unitCost: line.unitCost.toString(),
          sourceType: StockMoveSourceType.PURCHASE_INVOICE,
          sourceId: invoice.id,
          moveDate: invoice.invoiceDate,
        });
      } else {
        await this.inventoryService.receiveStock(tx, companyId, {
          itemId: line.itemId,
          warehouseId: line.warehouseId!,
          qty: line.qty.toString(),
          unitCost: line.unitCost.toString(),
          sourceType: StockMoveSourceType.PURCHASE_INVOICE,
          sourceId: invoice.id,
          moveDate: invoice.invoiceDate,
          batch: line.batchNumber ? { batchNumber: line.batchNumber, expiryDate: line.expiryDate ?? undefined } : undefined,
        });
      }
    }

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
