import { IsDateString, IsNumberString, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTaxRateDto {
  @IsUUID()
  taxTypeId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumberString()
  rate!: string;

  @IsUUID()
  payableAccountId!: string;

  @IsDateString()
  effectiveDate!: string;
}
