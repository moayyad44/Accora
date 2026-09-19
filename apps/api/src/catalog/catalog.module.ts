import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { UnitsController, CategoriesController, ItemsController } from "./catalog.controller";

@Module({
  providers: [CatalogService],
  controllers: [UnitsController, CategoriesController, ItemsController],
  exports: [CatalogService],
})
export class CatalogModule {}
