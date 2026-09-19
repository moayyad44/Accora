import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { ForbiddenException } from "@nestjs/common";

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.prisma.withTenant({ companyId: user.companyId, userId: user.sub }, (tx) =>
      this.usersService.me(tx, user.sub),
    );
  }

  @Get()
  @RequirePermission("core", "user", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    if (!user.companyId) throw new ForbiddenException("No active company selected");
    return this.prisma.withTenant({ companyId: user.companyId, userId: user.sub }, (tx) =>
      this.usersService.listCompanyUsers(tx, user.companyId!),
    );
  }
}
