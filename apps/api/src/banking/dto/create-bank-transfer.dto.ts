import { IsDateString, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateBankTransferDto {
  @IsUUID()
  fromAccountId!: string;

  @IsUUID()
  toAccountId!: string;

  @IsDateString()
  transferDate!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
