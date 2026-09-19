import { IsDateString, IsNumberString, IsUUID } from "class-validator";

export class SetStandardCostDto {
  @IsUUID()
  itemId!: string;

  @IsNumberString()
  materialCost!: string;

  @IsNumberString()
  laborCost!: string;

  @IsNumberString()
  overheadCost!: string;

  @IsDateString()
  effectiveDate!: string;
}
