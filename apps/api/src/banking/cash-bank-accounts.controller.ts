import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CashBankAccountsService } from "./cash-bank-accounts.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateCashBankAccountDto } from "./dto/create-cash-bank-account.dto";

@Controller("banking/accounts")
export class CashBankAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashBankAccountsService: CashBankAccountsService,
  ) {}

  @Get()
  @RequirePermission("banking", "cash_bank_account", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.cashBankAccountsService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("banking", "cash_bank_account", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.cashBankAccountsService.get(tx, companyId, id),
    );
  }

  @Get(":id/balance")
  @RequirePermission("banking", "cash_bank_account", "view")
  async balance(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    const balance = await this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.cashBankAccountsService.currentBalance(tx, companyId, id),
    );
    return { balance: balance.toFixed(4) };
  }

  @Post()
  @RequirePermission("banking", "cash_bank_account", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateCashBankAccountDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.cashBankAccountsService.create(tx, companyId, dto),
    );
  }
}
