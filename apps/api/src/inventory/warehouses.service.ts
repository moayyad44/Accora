import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateWarehouseInput {
  code: string;
  name: string;
  nameAr?: string;
  branchId?: string | null;
}

@Injectable()
export class WarehousesService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.warehouse.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateWarehouseInput) {
    const existing = await tx.warehouse.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Warehouse code ${input.code} already exists`);
    return tx.warehouse.create({
      data: { companyId, code: input.code, name: input.name, nameAr: input.nameAr, branchId: input.branchId ?? null },
    });
  }
}
