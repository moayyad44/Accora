import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AssetCategoriesService } from "./asset-categories.service";
import { AssetCategoriesController } from "./asset-categories.controller";
import { FixedAssetsService } from "./fixed-assets.service";
import { FixedAssetsController } from "./fixed-assets.controller";
import { DepreciationService } from "./depreciation.service";
import { DepreciationController } from "./depreciation.controller";

@Module({
  imports: [AccountingModule],
  providers: [AssetCategoriesService, FixedAssetsService, DepreciationService],
  controllers: [AssetCategoriesController, FixedAssetsController, DepreciationController],
  exports: [AssetCategoriesService, FixedAssetsService, DepreciationService],
})
export class FixedAssetsModule {}
