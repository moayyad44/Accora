import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PositionsService } from "./positions.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreatePositionDto } from "./dto/create-position.dto";

@Controller("hr/positions")
export class PositionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly positionsService: PositionsService,
  ) {}

  @Get()
  @RequirePermission("hr", "department", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.positionsService.list(tx, companyId));
  }

  @Post()
  @RequirePermission("hr", "department", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePositionDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.positionsService.create(tx, companyId, dto),
    );
  }
}
