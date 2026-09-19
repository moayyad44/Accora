import { Controller, ForbiddenException, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "./roles.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";

@Controller("roles")
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  @RequirePermission("core", "role", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    if (!user.companyId) throw new ForbiddenException("No active company selected");
    return this.prisma.withTenant({ companyId: user.companyId, userId: user.sub }, (tx) =>
      this.rolesService.listForCompany(tx, user.companyId!),
    );
  }
}
