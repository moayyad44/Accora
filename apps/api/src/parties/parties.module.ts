import { Module } from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { CustomersController, SuppliersController } from "./parties.controller";

@Module({
  providers: [PartiesService],
  controllers: [CustomersController, SuppliersController],
  exports: [PartiesService],
})
export class PartiesModule {}
