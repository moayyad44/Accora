import { IsNumberString, IsUUID } from "class-validator";

export class TransferStockDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  fromWarehouseId!: string;

  @IsUUID()
  toWarehouseId!: string;

  @IsNumberString()
  qty!: string;
}
