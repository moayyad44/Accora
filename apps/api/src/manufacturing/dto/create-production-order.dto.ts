import { IsDateString, IsNumberString, IsOptional, IsUUID } from "class-validator";

export class CreateProductionOrderDto {
  @IsUUID()
  itemId!: string;

  @IsNumberString()
  plannedQty!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
