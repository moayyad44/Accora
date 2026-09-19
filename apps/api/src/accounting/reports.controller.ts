import { Controller, Get, Param, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";

@Controller("accounting/reports")
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get("trial-balance")
  @RequirePermission("accounting", "financial_report", "view")
  trialBalance(@CurrentUser() user: AccessTokenPayload, @Query("asOfDate") asOfDate?: string) {
    const companyId = requireActiveCompany(user);
    const date = asOfDate ? new Date(asOfDate) : new Date();
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reportsService.trialBalance(tx, companyId, date),
    );
  }

  @Get("general-ledger/:accountId")
  @RequirePermission("accounting", "financial_report", "view")
  generalLedger(
    @CurrentUser() user: AccessTokenPayload,
    @Param("accountId") accountId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reportsService.generalLedger(
        tx,
        companyId,
        accountId,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined,
      ),
    );
  }
}
