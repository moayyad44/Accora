import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TaxRatesService } from "./tax-rates.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateTaxRateDto } from "./dto/create-tax-rate.dto";

@Controller("tax/rates")
export class TaxRatesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxRatesService: TaxRatesService,
  ) {}

  @Get()
  @RequirePermission("tax", "tax_type", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("taxTypeId") taxTypeId?: string) {
    const companyId = requireActiveCompany(user);
    if (!taxTypeId) throw new BadRequestException("taxTypeId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.taxRatesService.list(tx, companyId, taxTypeId),
    );
  }

  @Post()
  @RequirePermission("tax", "tax_type", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaxRateDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.taxRatesService.create(tx, companyId, {
        taxTypeId: dto.taxTypeId,
        name: dto.name,
        rate: dto.rate,
        payableAccountId: dto.payableAccountId,
        effectiveDate: new Date(dto.effectiveDate),
      }),
    );
  }
}
