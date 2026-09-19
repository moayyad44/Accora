import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
