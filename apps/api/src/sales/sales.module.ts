import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { SalesInvoicesService } from "./sales-invoices.service";
import { SalesInvoicesController } from "./sales-invoices.controller";

@Module({
  imports: [AccountingModule],
  providers: [SalesInvoicesService],
  controllers: [SalesInvoicesController],
})
export class SalesModule {}
