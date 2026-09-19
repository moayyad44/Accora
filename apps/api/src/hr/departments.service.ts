import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateDepartmentInput {
  name: string;
  nameAr?: string;
  parentId?: string;
}

@Injectable()
export class DepartmentsService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.department.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, departmentId: string) {
    const department = await tx.department.findFirst({
      where: { id: departmentId, companyId },
      include: { children: true, positions: true },
    });
    if (!department) throw new NotFoundException("Department not found");
    return department;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateDepartmentInput) {
    const existing = await tx.department.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Department "${input.name}" already exists`);

    if (input.parentId) {
      const parent = await tx.department.findFirst({ where: { id: input.parentId, companyId } });
      if (!parent) throw new NotFoundException("Parent department not found");
    }

    return tx.department.create({
      data: { companyId, name: input.name, nameAr: input.nameAr, parentId: input.parentId ?? null },
    });
  }
}
