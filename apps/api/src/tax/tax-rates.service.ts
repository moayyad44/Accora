import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";

export interface CreateTaxRateInput {
  taxTypeId: string;
  name: string;
  rate: string;
  payableAccountId: string;
  effectiveDate: Date;
}

@Injectable()
export class TaxRatesService {
  constructor(private readonly accountsService: AccountsService) {}

  async list(tx: Prisma.TransactionClient, companyId: string, taxTypeId: string) {
    const taxType = await tx.taxType.findFirst({ where: { id: taxTypeId, companyId } });
    if (!taxType) throw new NotFoundException("Tax type not found");
    return tx.taxRate.findMany({ where: { taxTypeId }, orderBy: { effectiveDate: "desc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateTaxRateInput) {
    const taxType = await tx.taxType.findFirst({ where: { id: input.taxTypeId, companyId } });
    if (!taxType) throw new NotFoundException("Tax type not found");

    const rate = new Decimal(input.rate);
    if (rate.isNegative()) throw new BadRequestException("rate cannot be negative");

    await this.accountsService.requirePostable(tx, companyId, input.payableAccountId);

    return tx.taxRate.create({
      data: {
        taxTypeId: input.taxTypeId,
        name: input.name,
        rate: rate.toFixed(3),
        payableAccountId: input.payableAccountId,
        effectiveDate: input.effectiveDate,
      },
    });
  }
}
