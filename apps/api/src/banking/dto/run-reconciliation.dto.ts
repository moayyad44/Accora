import { IsDateString, IsNumberString, IsUUID } from "class-validator";

export class RunReconciliationDto {
  @IsUUID()
  cashBankAccountId!: string;

  @IsDateString()
  statementDate!: string;

  @IsNumberString()
  statementBalance!: string;
}
