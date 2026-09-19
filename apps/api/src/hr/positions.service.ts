import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreatePositionInput {
  title: string;
  titleAr?: string;
  departmentId?: string;
}

@Injectable()
export class PositionsService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.position.findMany({ where: { companyId }, include: { department: true }, orderBy: { title: "asc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreatePositionInput) {
    const existing = await tx.position.findFirst({ where: { companyId, title: input.title } });
    if (existing) throw new BadRequestException(`Position "${input.title}" already exists`);

    if (input.departmentId) {
      const department = await tx.department.findFirst({ where: { id: input.departmentId, companyId } });
      if (!department) throw new NotFoundException("Department not found");
    }

    return tx.position.create({
      data: { companyId, title: input.title, titleAr: input.titleAr, departmentId: input.departmentId ?? null },
      include: { department: true },
    });
  }
}
