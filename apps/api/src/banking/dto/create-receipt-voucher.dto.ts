import { VoucherPartyType } from "@prisma/client";
import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateReceiptVoucherDto {
  @IsUUID()
  cashBankAccountId!: string;

  @IsDateString()
  voucherDate!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsEnum(VoucherPartyType)
  partyType!: VoucherPartyType;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  otherAccountId?: string;

  @IsOptional()
  @IsUUID()
  salesInvoiceId?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
