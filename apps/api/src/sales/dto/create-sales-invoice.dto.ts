import { Type } from "class-transformer";
import { InvoiceKind } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

class SalesInvoiceLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  qty!: string;

  @IsNumberString()
  unitPrice!: string;

  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Required when the item's trackingType is SERIAL — the specific units
   * to ship; length must equal qty. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreateSalesInvoiceDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(InvoiceKind)
  kind?: InvoiceKind;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceLineDto)
  @ArrayMinSize(1)
  lines!: SalesInvoiceLineDto[];
}
