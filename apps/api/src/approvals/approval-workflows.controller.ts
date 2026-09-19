import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApprovalWorkflowsService } from "./approval-workflows.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateApprovalWorkflowDto } from "./dto/create-approval-workflow.dto";

@Controller("approvals/workflows")
export class ApprovalWorkflowsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalWorkflowsService: ApprovalWorkflowsService,
  ) {}

  @Get()
  @RequirePermission("core", "approval_workflow", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("docType") docType?: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.approvalWorkflowsService.list(tx, companyId, docType),
    );
  }

  @Get(":id")
  @RequirePermission("core", "approval_workflow", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.approvalWorkflowsService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("core", "approval_workflow", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateApprovalWorkflowDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.approvalWorkflowsService.create(tx, companyId, {
        docType: dto.docType,
        name: dto.name,
        conditions: dto.conditions ? { minAmount: dto.conditions.minAmount } : undefined,
        steps: dto.steps,
      }),
    );
  }
}
