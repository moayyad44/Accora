import { PayrollItemType } from "@prisma/client";
import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class AddPayrollItemDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(PayrollItemType)
  type!: PayrollItemType;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  loanId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
