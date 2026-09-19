import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "./accounts.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Controller("accounting/accounts")
export class AccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  @Get()
  @RequirePermission("accounting", "chart_of_accounts", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.accountsService.list(tx, companyId));
  }

  @Post()
  @RequirePermission("accounting", "chart_of_accounts", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateAccountDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.accountsService.create(tx, companyId, dto),
    );
  }

  @Patch(":accountId")
  @RequirePermission("accounting", "chart_of_accounts", "update")
  update(@CurrentUser() user: AccessTokenPayload, @Param("accountId") accountId: string, @Body() dto: UpdateAccountDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.accountsService.update(tx, companyId, accountId, dto),
    );
  }
}
