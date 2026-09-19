import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, Prisma } from "@prisma/client";

export interface RequestLeaveInput {
  employeeId: string;
  type: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class LeavesService {
  async list(tx: Prisma.TransactionClient, companyId: string, employeeId?: string) {
    return tx.leave.findMany({
      where: { employee: { companyId }, ...(employeeId ? { employeeId } : {}) },
      include: { employee: true },
      orderBy: { startDate: "desc" },
    });
  }

  async request(tx: Prisma.TransactionClient, companyId: string, input: RequestLeaveInput) {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");
    if (input.endDate < input.startDate) throw new BadRequestException("endDate cannot be before startDate");

    return tx.leave.create({
      data: {
        employeeId: input.employeeId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async setStatus(tx: Prisma.TransactionClient, companyId: string, leaveId: string, status: "APPROVED" | "REJECTED") {
    const leave = await tx.leave.findFirst({ where: { id: leaveId, employee: { companyId } } });
    if (!leave) throw new NotFoundException("Leave request not found");
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status.toLowerCase()}`);
    }
    return tx.leave.update({ where: { id: leaveId }, data: { status } });
  }
}
