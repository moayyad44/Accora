import { DepreciationMethod } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class RegisterFixedAssetDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsDateString()
  purchaseDate!: string;

  @IsOptional()
  @IsDateString()
  usageStartDate?: string;

  @IsNumberString()
  cost!: string;

  @IsOptional()
  @IsNumberString()
  salvageValue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeMonths?: number;

  @IsOptional()
  @IsEnum(DepreciationMethod)
  depreciationMethod?: DepreciationMethod;

  @IsUUID()
  fundingAccountId!: string;
}
