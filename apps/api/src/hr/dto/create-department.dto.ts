import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
