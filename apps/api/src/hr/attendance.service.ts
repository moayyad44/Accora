import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export interface RecordAttendanceInput {
  employeeId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  overtimeHours?: string;
  status?: AttendanceStatus;
}

@Injectable()
export class AttendanceService {
  async list(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");
    return tx.attendance.findMany({ where: { employeeId }, orderBy: { date: "desc" } });
  }

  /** One row per employee per day — recording the same date again corrects
   * that day's entry rather than creating a duplicate (matches the unique
   * constraint on [employeeId, date]). */
  async record(tx: Prisma.TransactionClient, companyId: string, input: RecordAttendanceInput) {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");

    const overtimeHours = new Decimal(input.overtimeHours ?? 0);
    if (overtimeHours.isNegative()) throw new BadRequestException("overtimeHours cannot be negative");

    return tx.attendance.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
      update: {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        overtimeHours: overtimeHours.toFixed(2),
        status: input.status ?? AttendanceStatus.PRESENT,
      },
      create: {
        employeeId: input.employeeId,
        date: input.date,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        overtimeHours: overtimeHours.toFixed(2),
        status: input.status ?? AttendanceStatus.PRESENT,
      },
    });
  }
}
