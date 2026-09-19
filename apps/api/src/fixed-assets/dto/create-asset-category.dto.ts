import { DepreciationMethod } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateAssetCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsEnum(DepreciationMethod)
  defaultDepreciationMethod?: DepreciationMethod;

  @IsInt()
  @Min(1)
  defaultUsefulLifeMonths!: number;

  @IsUUID()
  assetAccountId!: string;

  @IsUUID()
  depreciationExpenseAccountId!: string;

  @IsUUID()
  accumulatedDepreciationAccountId!: string;
}
