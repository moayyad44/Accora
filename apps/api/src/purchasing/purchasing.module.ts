import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryModule } from "../inventory/inventory.module";
import { TaxModule } from "../tax/tax.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { PurchaseInvoicesService } from "./purchase-invoices.service";
import { PurchaseInvoicesController } from "./purchase-invoices.controller";

@Module({
  imports: [AccountingModule, InventoryModule, TaxModule, ApprovalsModule],
  providers: [PurchaseInvoicesService],
  controllers: [PurchaseInvoicesController],
})
export class PurchasingModule {}
