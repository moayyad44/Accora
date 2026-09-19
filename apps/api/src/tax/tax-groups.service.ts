import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export interface CreateTaxGroupInput {
  name: string;
  nameAr?: string;
  taxRateIds: string[];
}

export interface TaxLineBreakdown {
  taxRateId: string;
  payableAccountId: string;
  amount: string;
}

@Injectable()
export class TaxGroupsService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.taxGroup.findMany({
      where: { companyId },
      include: { rates: { include: { taxRate: { include: { taxType: true } } } } },
      orderBy: { name: "asc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, taxGroupId: string) {
    const group = await tx.taxGroup.findFirst({
      where: { id: taxGroupId, companyId },
      include: { rates: { include: { taxRate: { include: { taxType: true } } } } },
    });
    if (!group) throw new NotFoundException("Tax group not found");
    return group;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateTaxGroupInput) {
    const existing = await tx.taxGroup.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Tax group "${input.name}" already exists`);
    if (input.taxRateIds.length === 0) throw new BadRequestException("A tax group needs at least one tax rate");

    for (const taxRateId of input.taxRateIds) {
      const rate = await tx.taxRate.findFirst({ where: { id: taxRateId, taxType: { companyId } } });
      if (!rate) throw new NotFoundException(`Tax rate ${taxRateId} not found in this company`);
    }

    return tx.taxGroup.create({
      data: {
        companyId,
        name: input.name,
        nameAr: input.nameAr,
        rates: { create: input.taxRateIds.map((taxRateId) => ({ taxRateId })) },
      },
      include: { rates: { include: { taxRate: true } } },
    });
  }

  /**
   * What a tax group actually charges on a given base amount, as of a
   * given date: every rate in the group that's active and already
   * effective on that date, applied independently (never assumed to sum
   * to one flat percentage — a group can legitimately bundle rates that
   * post to different payable accounts, e.g. a national + a municipal
   * tax). An expired or not-yet-effective rate is silently skipped, same
   * as a company simply not having configured tax yet — never an error.
   */
  async computeTax(
    tx: Prisma.TransactionClient,
    companyId: string,
    taxGroupId: string,
    baseAmount: Decimal,
    asOfDate: Date,
  ): Promise<{ totalTax: Decimal; breakdown: TaxLineBreakdown[] }> {
    const group = await tx.taxGroup.findFirst({
      where: { id: taxGroupId, companyId },
      include: { rates: { include: { taxRate: true } } },
    });
    if (!group) throw new NotFoundException("Tax group not found");

    let totalTax = new Decimal(0);
    const breakdown: TaxLineBreakdown[] = [];
    for (const groupRate of group.rates) {
      const rate = groupRate.taxRate;
      if (!rate.isActive || rate.effectiveDate > asOfDate) continue;
      const amount = baseAmount.times(new Decimal(rate.rate.toString())).div(100);
      if (amount.lte(0)) continue;
      totalTax = totalTax.plus(amount);
      breakdown.push({ taxRateId: rate.id, payableAccountId: rate.payableAccountId, amount: amount.toFixed(4) });
    }
    return { totalTax, breakdown };
  }
}
