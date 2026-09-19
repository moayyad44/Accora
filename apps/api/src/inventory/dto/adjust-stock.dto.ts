import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class AdjustStockDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  qty!: string;

  @IsIn(["INCREASE", "DECREASE"])
  direction!: "INCREASE" | "DECREASE";

  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
