import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
