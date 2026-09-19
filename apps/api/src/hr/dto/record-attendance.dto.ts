import { AttendanceStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsNumberString, IsOptional, IsUUID } from "class-validator";

export class RecordAttendanceDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsNumberString()
  overtimeHours?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
