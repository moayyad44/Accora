import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReconciliationService } from "./reconciliation.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RunReconciliationDto } from "./dto/run-reconciliation.dto";
import { MarkReconciledDto } from "./dto/mark-reconciled.dto";

@Controller("banking/reconciliations")
export class ReconciliationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  @Get()
  @RequirePermission("banking", "bank_reconciliation", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("cashBankAccountId") cashBankAccountId?: string) {
    const companyId = requireActiveCompany(user);
    if (!cashBankAccountId) throw new BadRequestException("cashBankAccountId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reconciliationService.list(tx, companyId, cashBankAccountId),
    );
  }

  @Get("unreconciled")
  @RequirePermission("banking", "bank_reconciliation", "view")
  unreconciled(
    @CurrentUser() user: AccessTokenPayload,
    @Query("cashBankAccountId") cashBankAccountId?: string,
    @Query("asOfDate") asOfDate?: string,
  ) {
    const companyId = requireActiveCompany(user);
    if (!cashBankAccountId) throw new BadRequestException("cashBankAccountId query param is required");
    if (!asOfDate) throw new BadRequestException("asOfDate query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reconciliationService.listUnreconciled(tx, companyId, cashBankAccountId, new Date(asOfDate)),
    );
  }

  @Post()
  @RequirePermission("banking", "bank_reconciliation", "create")
  run(@CurrentUser() user: AccessTokenPayload, @Body() dto: RunReconciliationDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reconciliationService.run(tx, companyId, {
        cashBankAccountId: dto.cashBankAccountId,
        statementDate: new Date(dto.statementDate),
        statementBalance: dto.statementBalance,
      }),
    );
  }

  @Post("mark-reconciled")
  @RequirePermission("banking", "bank_reconciliation", "update")
  markReconciled(@CurrentUser() user: AccessTokenPayload, @Body() dto: MarkReconciledDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.reconciliationService.markReconciled(tx, companyId, dto),
    );
  }
}
