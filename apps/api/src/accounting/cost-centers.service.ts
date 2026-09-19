import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateCostCenterInput {
  code: string;
  name: string;
  nameAr?: string;
  parentId?: string | null;
  branchId?: string | null;
}

@Injectable()
export class CostCentersService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.costCenter.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateCostCenterInput) {
    const existing = await tx.costCenter.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Cost center code ${input.code} already exists`);

    if (input.parentId) {
      const parent = await tx.costCenter.findFirst({ where: { id: input.parentId, companyId } });
      if (!parent) throw new NotFoundException("Parent cost center not found");
    }

    return tx.costCenter.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        nameAr: input.nameAr,
        parentId: input.parentId ?? null,
        branchId: input.branchId ?? null,
      },
    });
  }
}
