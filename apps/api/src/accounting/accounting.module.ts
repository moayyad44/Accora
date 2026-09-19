import { Module } from "@nestjs/common";
import { FiscalService } from "./fiscal.service";
import { FiscalController } from "./fiscal.controller";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";
import { CostCentersService } from "./cost-centers.service";
import { CostCentersController } from "./cost-centers.controller";
import { NumberingService } from "./numbering.service";
import { JournalEntriesService } from "./journal-entries.service";
import { JournalEntriesController } from "./journal-entries.controller";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

@Module({
  providers: [
    FiscalService,
    AccountsService,
    CostCentersService,
    NumberingService,
    JournalEntriesService,
    ReportsService,
  ],
  controllers: [
    FiscalController,
    AccountsController,
    CostCentersController,
    JournalEntriesController,
    ReportsController,
  ],
  exports: [FiscalService, AccountsService, JournalEntriesService],
})
export class AccountingModule {}
