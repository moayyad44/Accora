import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LeavesService } from "./leaves.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RequestLeaveDto } from "./dto/request-leave.dto";
import { SetLeaveStatusDto } from "./dto/set-leave-status.dto";

@Controller("hr/leaves")
export class LeavesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leavesService: LeavesService,
  ) {}

  @Get()
  @RequirePermission("hr", "leave", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("employeeId") employeeId?: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.leavesService.list(tx, companyId, employeeId),
    );
  }

  @Post()
  @RequirePermission("hr", "leave", "create")
  request(@CurrentUser() user: AccessTokenPayload, @Body() dto: RequestLeaveDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.leavesService.request(tx, companyId, {
        employeeId: dto.employeeId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      }),
    );
  }

  @Patch(":id/status")
  @RequirePermission("hr", "leave", "approve")
  setStatus(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: SetLeaveStatusDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.leavesService.setStatus(tx, companyId, id, dto.status),
    );
  }
}
