import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardService } from "./dashboard.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
  ) {}

  @Get("summary")
  @RequirePermission("accounting", "financial_report", "view")
  summary(@CurrentUser() user: AccessTokenPayload, @Query("asOfDate") asOfDate?: string) {
    const companyId = requireActiveCompany(user);
    const date = asOfDate ? new Date(asOfDate) : new Date();
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.dashboardService.summary(tx, companyId, date),
    );
  }
}
