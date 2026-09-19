import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { WarehousesService } from "./warehouses.service";
import { WarehousesController } from "./warehouses.controller";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { StockAdjustmentsService } from "./stock-adjustments.service";

@Module({
  imports: [AccountingModule],
  providers: [WarehousesService, InventoryService, StockAdjustmentsService],
  controllers: [WarehousesController, InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
