import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.prisma.withTenant({ companyId: user.companyId, userId: user.sub, isSuperAdmin: user.isSuperAdmin }, (tx) =>
      this.usersService.me(tx, user.sub, user.companyId, user.roleId),
    );
  }

  @Get()
  @RequirePermission("core", "user", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.usersService.listCompanyUsers(tx, companyId),
    );
  }
}
