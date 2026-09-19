import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Generates document numbers like JV-2026-000001 from a company's
 * DocumentSequence configuration (see docs/ARCHITECTURE.md §32).
 *
 * Concurrency note: the increment itself (`update ... currentNumber:
 * increment`) takes a row lock, so two concurrent postings against an
 * EXISTING sequence row serialize correctly and never hand out the same
 * number. The one gap is the very first number ever issued for a given
 * (companyId, branchId=null, docType): two simultaneous first-time
 * requests could each decide the row doesn't exist yet and both insert
 * one, because Postgres does not treat two NULL branchId values as
 * conflicting for uniqueness purposes. Documented and accepted for Phase
 * 4 — extremely narrow window, self-corrects (the loser's row just goes
 * unused), and does not affect balance/correctness of any journal entry.
 */
@Injectable()
export class NumberingService {
  async next(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string | null,
    docType: string,
    date: Date,
  ): Promise<string> {
    let sequence = await tx.documentSequence.findFirst({ where: { companyId, branchId, docType } });
    if (!sequence) {
      sequence = await tx.documentSequence.create({
        data: { companyId, branchId, docType, prefix: this.defaultPrefix(docType) },
      });
    }

    const updated = await tx.documentSequence.update({
      where: { id: sequence.id },
      data: { currentNumber: { increment: 1 } },
    });

    return this.format(updated.pattern, updated.prefix, updated.currentNumber, date);
  }

  private defaultPrefix(docType: string): string {
    const known: Record<string, string> = {
      JOURNAL_VOUCHER: "JV",
      SALES_INVOICE: "INV",
      PURCHASE_ORDER: "PO",
      PURCHASE_INVOICE: "PINV",
      PRODUCTION_ORDER: "MO",
      FIXED_ASSET: "FA",
      EMPLOYEE: "EMP",
      RECEIPT_VOUCHER: "RV",
      PAYMENT_VOUCHER: "PV",
      BANK_TRANSFER: "BT",
    };
    return known[docType] ?? docType.slice(0, 3).toUpperCase();
  }

  private format(pattern: string, prefix: string, seq: number, date: Date): string {
    return pattern
      .replace("{prefix}", prefix)
      .replace("{year}", String(date.getUTCFullYear()))
      .replace(/\{seq:(\d+)\}/, (_match, width: string) => String(seq).padStart(Number(width), "0"));
  }
}
