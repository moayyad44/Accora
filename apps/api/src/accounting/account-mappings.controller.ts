import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountMappingsService } from "./account-mappings.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { SetAccountMappingDto } from "./dto/set-account-mapping.dto";

@Controller("accounting/account-mappings")
export class AccountMappingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountMappingsService: AccountMappingsService,
  ) {}

  @Get()
  @RequirePermission("accounting", "account_mapping", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.accountMappingsService.list(tx, companyId),
    );
  }

  @Patch(":key")
  @RequirePermission("accounting", "account_mapping", "update")
  set(@CurrentUser() user: AccessTokenPayload, @Param("key") key: string, @Body() dto: SetAccountMappingDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.accountMappingsService.set(tx, companyId, key, dto.accountId),
    );
  }
}
