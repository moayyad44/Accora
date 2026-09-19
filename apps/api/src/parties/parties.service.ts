import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateCustomerInput {
  code: string;
  name: string;
  nameAr?: string;
  groupId?: string | null;
  creditLimit?: string;
  paymentTermDays?: number;
  arAccountId?: string | null;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  nameAr?: string;
  paymentTermDays?: number;
  apAccountId?: string | null;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

@Injectable()
export class PartiesService {
  async listCustomers(tx: Prisma.TransactionClient, companyId: string) {
    return tx.customer.findMany({ where: { companyId }, orderBy: { code: "asc" }, include: { group: true } });
  }

  async createCustomer(tx: Prisma.TransactionClient, companyId: string, input: CreateCustomerInput) {
    const existing = await tx.customer.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Customer code ${input.code} already exists`);

    if (input.arAccountId) {
      const account = await tx.account.findFirst({ where: { id: input.arAccountId, companyId } });
      if (!account) throw new NotFoundException("arAccountId not found in this company");
    }

    return tx.customer.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        nameAr: input.nameAr,
        groupId: input.groupId ?? null,
        creditLimit: input.creditLimit ?? "0",
        paymentTermDays: input.paymentTermDays ?? 0,
        arAccountId: input.arAccountId ?? null,
        taxNumber: input.taxNumber,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
    });
  }

  async listSuppliers(tx: Prisma.TransactionClient, companyId: string) {
    return tx.supplier.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  }

  async createSupplier(tx: Prisma.TransactionClient, companyId: string, input: CreateSupplierInput) {
    const existing = await tx.supplier.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (existing) throw new BadRequestException(`Supplier code ${input.code} already exists`);

    if (input.apAccountId) {
      const account = await tx.account.findFirst({ where: { id: input.apAccountId, companyId } });
      if (!account) throw new NotFoundException("apAccountId not found in this company");
    }

    return tx.supplier.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        nameAr: input.nameAr,
        paymentTermDays: input.paymentTermDays ?? 0,
        apAccountId: input.apAccountId ?? null,
        taxNumber: input.taxNumber,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
    });
  }
}
