import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StandardCostsService } from "./standard-costs.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { SetStandardCostDto } from "./dto/set-standard-cost.dto";

@Controller("manufacturing/standard-costs")
export class StandardCostsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly standardCostsService: StandardCostsService,
  ) {}

  @Get()
  @RequirePermission("manufacturing", "standard_cost", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("itemId") itemId?: string) {
    const companyId = requireActiveCompany(user);
    if (!itemId) throw new BadRequestException("itemId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.standardCostsService.list(tx, companyId, itemId),
    );
  }

  @Post()
  @RequirePermission("manufacturing", "standard_cost", "create")
  set(@CurrentUser() user: AccessTokenPayload, @Body() dto: SetStandardCostDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.standardCostsService.set(tx, companyId, { ...dto, effectiveDate: new Date(dto.effectiveDate) }),
    );
  }
}
