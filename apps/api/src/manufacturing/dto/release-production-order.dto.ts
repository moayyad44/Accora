import { IsObject, IsOptional } from "class-validator";

export class ReleaseProductionOrderDto {
  /** Only needed when a BOM component is a serial-tracked item — maps that
   * component's itemId to the exact units to consume, since serial units
   * (unlike FIFO/weighted-average stock) can't be picked automatically. */
  @IsOptional()
  @IsObject()
  componentSerials?: Record<string, string[]>;
}
