import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export interface CreateContractInput {
  employeeId: string;
  startDate: Date;
  endDate?: Date;
  baseSalary: string;
  terms?: string;
}

@Injectable()
export class ContractsService {
  async list(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");
    return tx.contract.findMany({ where: { employeeId }, orderBy: { startDate: "desc" } });
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateContractInput) {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");

    const baseSalary = new Decimal(input.baseSalary);
    if (baseSalary.lte(0)) throw new BadRequestException("baseSalary must be greater than zero");
    if (input.endDate && input.endDate <= input.startDate) {
      throw new BadRequestException("endDate must be after startDate");
    }

    return tx.contract.create({
      data: {
        employeeId: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        baseSalary: baseSalary.toFixed(4),
        terms: input.terms,
      },
    });
  }

  /** The contract in effect for an employee on a given date — what payroll
   * draft generation uses to know a current base salary. Returns null
   * (never throws) when the employee simply has no contract covering that
   * date, since that's a legitimate "skip this employee" case for the
   * caller rather than an error. */
  async getCurrentContract(tx: Prisma.TransactionClient, employeeId: string, asOfDate: Date) {
    return tx.contract.findFirst({
      where: {
        employeeId,
        startDate: { lte: asOfDate },
        OR: [{ endDate: null }, { endDate: { gte: asOfDate } }],
      },
      orderBy: { startDate: "desc" },
    });
  }
}
