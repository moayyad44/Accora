import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CompaniesModule } from "./companies/companies.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { AccountingModule } from "./accounting/accounting.module";
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
  ],
  providers: [
    // Order matters: JwtAuthGuard runs first and populates request.user,
    // PermissionsGuard then checks that user's role against @RequirePermission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
