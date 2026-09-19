import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { WarehousesService } from "./warehouses.service";
import { WarehousesController } from "./warehouses.controller";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { StockAdjustmentsService } from "./stock-adjustments.service";
import { StockCountsService } from "./stock-counts.service";
import { StockCountsController } from "./stock-counts.controller";
import { SerialTrackingService } from "./serial-tracking.service";

@Module({
  imports: [AccountingModule],
  providers: [WarehousesService, InventoryService, StockAdjustmentsService, StockCountsService, SerialTrackingService],
  controllers: [WarehousesController, InventoryController, StockCountsController],
  exports: [InventoryService, SerialTrackingService],
})
export class InventoryModule {}
