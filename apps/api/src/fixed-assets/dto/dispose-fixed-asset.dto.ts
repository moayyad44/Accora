import { IsDateString, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class DisposeFixedAssetDto {
  @IsDateString()
  disposalDate!: string;

  @IsOptional()
  @IsNumberString()
  proceeds?: string;

  @IsOptional()
  @IsUUID()
  proceedsAccountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
