import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PurchaseInvoicesService } from "./purchase-invoices.service";
import { PurchaseInvoicesController } from "./purchase-invoices.controller";

@Module({
  imports: [AccountingModule],
  providers: [PurchaseInvoicesService],
  controllers: [PurchaseInvoicesController],
})
export class PurchasingModule {}
