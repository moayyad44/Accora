import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryModule } from "../inventory/inventory.module";
import { SalesInvoicesService } from "./sales-invoices.service";
import { SalesInvoicesController } from "./sales-invoices.controller";

@Module({
  imports: [AccountingModule, InventoryModule],
  providers: [SalesInvoicesService],
  controllers: [SalesInvoicesController],
})
export class SalesModule {}
