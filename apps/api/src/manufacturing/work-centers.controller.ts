import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkCentersService } from "./work-centers.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateWorkCenterDto } from "./dto/create-work-center.dto";

@Controller("manufacturing/work-centers")
export class WorkCentersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workCentersService: WorkCentersService,
  ) {}

  @Get()
  @RequirePermission("manufacturing", "work_center", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.workCentersService.list(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("manufacturing", "work_center", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateWorkCenterDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.workCentersService.create(tx, companyId, dto),
    );
  }
}
