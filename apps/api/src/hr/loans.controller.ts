import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LoansService } from "./loans.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { GrantLoanDto } from "./dto/grant-loan.dto";

@Controller("hr/loans")
export class LoansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loansService: LoansService,
  ) {}

  @Get()
  @RequirePermission("hr", "loan", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("employeeId") employeeId?: string) {
    const companyId = requireActiveCompany(user);
    if (!employeeId) throw new BadRequestException("employeeId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.loansService.list(tx, companyId, employeeId),
    );
  }

  @Post()
  @RequirePermission("hr", "loan", "create")
  grant(@CurrentUser() user: AccessTokenPayload, @Body() dto: GrantLoanDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.loansService.grant(tx, companyId, user.sub, {
        employeeId: dto.employeeId,
        amount: dto.amount,
        installments: dto.installments,
        startDate: new Date(dto.startDate),
        fundingAccountId: dto.fundingAccountId,
      }),
    );
  }
}
