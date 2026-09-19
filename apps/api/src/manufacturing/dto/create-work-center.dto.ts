import { IsNumberString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorkCenterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsNumberString()
  costPerHour?: string;
}
