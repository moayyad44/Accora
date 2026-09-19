import { AccountType, NormalBalance } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @IsOptional()
  @IsBoolean()
  isHeader?: boolean;
}
