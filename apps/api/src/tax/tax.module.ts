import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { TaxTypesService } from "./tax-types.service";
import { TaxTypesController } from "./tax-types.controller";
import { TaxRatesService } from "./tax-rates.service";
import { TaxRatesController } from "./tax-rates.controller";
import { TaxGroupsService } from "./tax-groups.service";
import { TaxGroupsController } from "./tax-groups.controller";

@Module({
  imports: [AccountingModule],
  providers: [TaxTypesService, TaxRatesService, TaxGroupsService],
  controllers: [TaxTypesController, TaxRatesController, TaxGroupsController],
  exports: [TaxGroupsService],
})
export class TaxModule {}
