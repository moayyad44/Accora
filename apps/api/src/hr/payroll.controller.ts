import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { PayrollRunStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollService } from "./payroll.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { AddPayrollItemDto } from "./dto/add-payroll-item.dto";

@Controller("hr/payroll-runs")
export class PayrollController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollService: PayrollService,
  ) {}

  @Get()
  @RequirePermission("hr", "payroll_run", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: PayrollRunStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.payrollService.list(tx, companyId, status));
  }

  @Get(":id")
  @RequirePermission("hr", "payroll_run", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.payrollService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("hr", "payroll_run", "create")
  createDraft(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePayrollRunDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.payrollService.createDraft(tx, companyId, dto.periodId),
    );
  }

  @Post(":id/items")
  @RequirePermission("hr", "payroll_run", "update")
  addItem(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: AddPayrollItemDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.payrollService.addItem(tx, companyId, id, dto),
    );
  }

  @Delete(":id/items/:itemId")
  @RequirePermission("hr", "payroll_run", "update")
  removeItem(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Param("itemId") itemId: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.payrollService.removeItem(tx, companyId, id, itemId),
    );
  }

  @Post(":id/approve")
  @RequirePermission("hr", "payroll_run", "approve")
  approve(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.payrollService.approve(tx, companyId, id));
  }

  @Post(":id/post")
  @RequirePermission("hr", "payroll_run", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.payrollService.post(tx, companyId, user.sub, id),
    );
  }
}
