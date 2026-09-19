import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CompaniesModule } from "./companies/companies.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { AccountingModule } from "./accounting/accounting.module";
import { PartiesModule } from "./parties/parties.module";
import { CatalogModule } from "./catalog/catalog.module";
import { InventoryModule } from "./inventory/inventory.module";
import { SalesModule } from "./sales/sales.module";
import { PurchasingModule } from "./purchasing/purchasing.module";
import { ManufacturingModule } from "./manufacturing/manufacturing.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesModule,
    AccountingModule,
    PartiesModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    PurchasingModule,
    ManufacturingModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard runs first and populates request.user,
    // PermissionsGuard then checks that user's role against @RequirePermission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
