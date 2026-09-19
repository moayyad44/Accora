import { StockCountType } from "@prisma/client";
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export class CreateStockCountDto {
  @IsUUID()
  warehouseId!: string;

  @IsEnum(StockCountType)
  type!: StockCountType;

  @IsDateString()
  countDate!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds?: string[];
}
