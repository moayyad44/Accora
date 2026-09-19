import { Type } from "class-transformer";
import { ArrayMinSize, IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

class BomLineDto {
  @IsUUID()
  componentItemId!: string;

  @IsNumberString()
  qty!: string;

  @IsUUID()
  unitId!: string;

  @IsOptional()
  @IsNumberString()
  scrapPercent?: string;
}

export class CreateBomDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  @ArrayMinSize(1)
  lines!: BomLineDto[];
}
