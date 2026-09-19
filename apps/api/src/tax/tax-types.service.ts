import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateTaxTypeInput {
  name: string;
  nameAr?: string;
}

@Injectable()
export class TaxTypesService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.taxType.findMany({ where: { companyId }, include: { rates: true }, orderBy: { name: "asc" } });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, taxTypeId: string) {
    const taxType = await tx.taxType.findFirst({ where: { id: taxTypeId, companyId }, include: { rates: true } });
    if (!taxType) throw new NotFoundException("Tax type not found");
    return taxType;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateTaxTypeInput) {
    const existing = await tx.taxType.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Tax type "${input.name}" already exists`);
    return tx.taxType.create({ data: { companyId, name: input.name, nameAr: input.nameAr } });
  }
}
