import { Type } from "class-transformer";
import { ArrayMinSize, IsDateString, IsNumberString, IsOptional, IsUUID, ValidateNested } from "class-validator";

class PurchaseInvoiceLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  qty!: string;

  @IsNumberString()
  unitCost!: string;
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
