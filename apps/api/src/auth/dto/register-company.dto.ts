import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterCompanyDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsOptional()
  @IsString()
  companyNameAr?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @MinLength(2)
  baseCurrencyCode!: string;

  @IsString()
  @MinLength(2)
  adminFullName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
