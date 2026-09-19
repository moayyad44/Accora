import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryModule } from "../inventory/inventory.module";
import { WorkCentersService } from "./work-centers.service";
import { WorkCentersController } from "./work-centers.controller";
import { BomsService } from "./boms.service";
import { BomsController } from "./boms.controller";
import { StandardCostsService } from "./standard-costs.service";
import { StandardCostsController } from "./standard-costs.controller";
import { ProductionOrdersService } from "./production-orders.service";
import { ProductionOrdersController } from "./production-orders.controller";

@Module({
  imports: [AccountingModule, InventoryModule],
  providers: [WorkCentersService, BomsService, StandardCostsService, ProductionOrdersService],
  controllers: [WorkCentersController, BomsController, StandardCostsController, ProductionOrdersController],
  exports: [BomsService, StandardCostsService, ProductionOrdersService],
})
export class ManufacturingModule {}
