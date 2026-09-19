import { Body, Controller, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DepreciationService } from "./depreciation.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RunDepreciationDto } from "./dto/run-depreciation.dto";

@Controller("fixed-assets/depreciation-runs")
export class DepreciationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depreciationService: DepreciationService,
  ) {}

  @Post()
  @RequirePermission("fixed_assets", "depreciation_run", "post")
  run(@CurrentUser() user: AccessTokenPayload, @Body() dto: RunDepreciationDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.depreciationService.run(tx, companyId, user.sub, dto.periodId),
    );
  }
}
