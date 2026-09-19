import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateWorkCenterInput {
  name: string;
  nameAr?: string;
  costPerHour?: string;
}

@Injectable()
export class WorkCentersService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.workCenter.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateWorkCenterInput) {
    const existing = await tx.workCenter.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Work center "${input.name}" already exists`);
    return tx.workCenter.create({
      data: { companyId, name: input.name, nameAr: input.nameAr, costPerHour: input.costPerHour ?? "0" },
    });
  }
}
