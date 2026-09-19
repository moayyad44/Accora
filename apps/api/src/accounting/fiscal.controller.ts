import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FiscalService } from "./fiscal.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateFiscalYearDto } from "./dto/create-fiscal-year.dto";
import { SetPeriodStatusDto } from "./dto/set-period-status.dto";

@Controller("accounting/fiscal-years")
export class FiscalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalService: FiscalService,
  ) {}

  @Get()
  @RequirePermission("core", "fiscal_period", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fiscalService.listFiscalYears(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("core", "fiscal_period", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateFiscalYearDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fiscalService.createFiscalYear(tx, companyId, {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      }),
    );
  }

  @Patch("periods/:periodId")
  @RequirePermission("core", "fiscal_period", "close")
  setPeriodStatus(
    @CurrentUser() user: AccessTokenPayload,
    @Param("periodId") periodId: string,
    @Body() dto: SetPeriodStatusDto,
  ) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fiscalService.setPeriodStatus(tx, companyId, periodId, dto.status),
    );
  }
}
