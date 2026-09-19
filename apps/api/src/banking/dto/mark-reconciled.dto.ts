import { IsArray, IsOptional, IsUUID } from "class-validator";

export class MarkReconciledDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  receiptVoucherIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  paymentVoucherIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  bankTransferIds?: string[];
}
