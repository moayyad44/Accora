import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

class PurchaseInvoiceLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  qty!: string;

  @IsNumberString()
  unitCost!: string;

  /** Required when the item's trackingType is BATCH. */
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  /** Required when the item's trackingType is SERIAL — length must equal qty. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreatePurchaseInvoiceDto {
  @IsUUID()
  supplierId!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateNested({ each: true })
  @Type(() => PurchaseInvoiceLineDto)
  @ArrayMinSize(1)
  lines!: PurchaseInvoiceLineDto[];
}
