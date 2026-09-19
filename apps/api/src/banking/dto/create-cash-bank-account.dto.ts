import { CashBankAccountType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateCashBankAccountDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsEnum(CashBankAccountType)
  type!: CashBankAccountType;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  iban?: string;
}
