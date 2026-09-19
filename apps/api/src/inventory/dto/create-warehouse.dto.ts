import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
