import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

class JournalEntryLineDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsNumberString()
  debit?: string;

  @IsOptional()
  @IsNumberString()
  credit?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  @ArrayMinSize(2)
  lines!: JournalEntryLineDto[];
}
