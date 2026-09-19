import { Type } from "class-transformer";
import { IsArray, IsDateString, IsNumberString, IsOptional, IsString, ValidateNested } from "class-validator";

class OutputBatchDto {
  @IsString()
  batchNumber!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;
}

export class CompleteProductionOrderDto {
  /** Defaults to the order's plannedQty when omitted — set it to record
   * that fewer (or more) units actually came out than planned. */
  @IsOptional()
  @IsNumberString()
  actualQty?: string;

  @IsOptional()
  @IsNumberString()
  laborCost?: string;

  @IsOptional()
  @IsNumberString()
  overheadCost?: string;

  /** Required, one per unit, when the produced item is serial-tracked. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputSerialNumbers?: string[];

  /** Required when the produced item is batch-tracked. */
  @IsOptional()
  @ValidateNested()
  @Type(() => OutputBatchDto)
  outputBatch?: OutputBatchDto;
}
