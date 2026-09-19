import { Type } from "class-transformer";
import { InvoiceKind } from "@prisma/client";
import {
  ArrayMinSize,
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
