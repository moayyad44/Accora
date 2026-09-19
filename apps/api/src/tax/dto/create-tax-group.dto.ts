import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTaxGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  taxRateIds!: string[];
}
