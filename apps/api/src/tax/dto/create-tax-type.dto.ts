import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateTaxTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;
}
