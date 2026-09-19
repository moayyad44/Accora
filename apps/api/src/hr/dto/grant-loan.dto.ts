import { IsDateString, IsInt, IsNumberString, IsUUID, Min } from "class-validator";

export class GrantLoanDto {
  @IsUUID()
  employeeId!: string;

  @IsNumberString()
  amount!: string;

  @IsInt()
  @Min(1)
  installments!: number;

  @IsDateString()
  startDate!: string;

  @IsUUID()
  fundingAccountId!: string;
}
