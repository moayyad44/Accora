import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { BankingModule } from "../banking/banking.module";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

@Module({
  imports: [AccountingModule, BankingModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
