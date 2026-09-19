import { Injectable, NotFoundException } from "@nestjs/common";
import { EmployeeStatus, Prisma } from "@prisma/client";
import { NumberingService } from "../accounting/numbering.service";

export interface CreateEmployeeInput {
  fullName: string;
  fullNameAr?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  hireDate: Date;
  branchId?: string;
  departmentId?: string;
  positionId?: string;
}

@Injectable()
export class EmployeesService {
  constructor(private readonly numberingService: NumberingService) {}

  async list(tx: Prisma.TransactionClient, companyId: string, status?: EmployeeStatus) {
    return tx.employee.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { department: true, position: true },
      orderBy: { fullName: "asc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        department: true,
        position: true,
        contracts: { orderBy: { startDate: "desc" } },
        loans: { orderBy: { startDate: "desc" } },
      },
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateEmployeeInput) {
    if (input.departmentId) {
      const department = await tx.department.findFirst({ where: { id: input.departmentId, companyId } });
      if (!department) throw new NotFoundException("Department not found");
    }
    if (input.positionId) {
      const position = await tx.position.findFirst({ where: { id: input.positionId, companyId } });
      if (!position) throw new NotFoundException("Position not found");
    }
    if (input.branchId) {
      const branch = await tx.branch.findFirst({ where: { id: input.branchId, companyId } });
      if (!branch) throw new NotFoundException("Branch not found");
    }

    const employeeNumber = await this.numberingService.next(tx, companyId, null, "EMPLOYEE", input.hireDate);

    return tx.employee.create({
      data: {
        companyId,
        employeeNumber,
        fullName: input.fullName,
        fullNameAr: input.fullNameAr,
        nationalId: input.nationalId,
        phone: input.phone,
        email: input.email,
        hireDate: input.hireDate,
        branchId: input.branchId,
        departmentId: input.departmentId,
        positionId: input.positionId,
        status: EmployeeStatus.ACTIVE,
      },
      include: { department: true, position: true },
    });
  }
}
