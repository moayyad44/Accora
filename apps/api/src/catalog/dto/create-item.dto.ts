import { ItemTrackingType, ItemType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsUUID()
  baseUnitId!: string;

  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @IsOptional()
  @IsEnum(ItemTrackingType)
  trackingType?: ItemTrackingType;

  @IsOptional()
  @IsString()
  barcode?: string;
}
