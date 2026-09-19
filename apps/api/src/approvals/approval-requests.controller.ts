import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApprovalRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApprovalService } from "./approval.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RequestApprovalDto } from "./dto/request-approval.dto";
import { DecideApprovalDto } from "./dto/decide-approval.dto";

@Controller("approvals/requests")
export class ApprovalRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Get()
  @RequirePermission("core", "approval_workflow", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: ApprovalRequestStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.approvalService.list(tx, companyId, status));
  }

  @Get(":id")
  @RequirePermission("core", "approval_workflow", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.approvalService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("core", "approval_workflow", "create")
  request(@CurrentUser() user: AccessTokenPayload, @Body() dto: RequestApprovalDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.approvalService.requestApproval(tx, companyId, dto.docType, dto.docId, dto.amount),
    );
  }

  @Post(":id/decide")
  @RequirePermission("core", "approval_workflow", "update")
  decide(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: DecideApprovalDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.approvalService.decide(tx, companyId, user.sub, id, dto.decision, dto.comment),
    );
  }
}
