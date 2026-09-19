import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CostCentersService } from "./cost-centers.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";

@Controller("accounting/cost-centers")
export class CostCentersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costCentersService: CostCentersService,
  ) {}

  @Get()
  @RequirePermission("accounting", "cost_center", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.costCentersService.list(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("accounting", "cost_center", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateCostCenterDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.costCentersService.create(tx, companyId, dto),
    );
  }
}
