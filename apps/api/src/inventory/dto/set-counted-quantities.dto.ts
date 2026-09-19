import { Type } from "class-transformer";
import { ArrayMinSize, IsNumberString, IsUUID, ValidateNested } from "class-validator";

class CountedLineDto {
  @IsUUID()
  itemId!: string;

  @IsNumberString()
  countedQty!: string;
}

export class SetCountedQuantitiesDto {
  @ValidateNested({ each: true })
  @Type(() => CountedLineDto)
  @ArrayMinSize(1)
  lines!: CountedLineDto[];
}
