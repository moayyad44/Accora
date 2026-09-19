import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { REQUIRED_PERMISSION_KEY, RequiredPermission } from "../decorators/require-permission.decorator";
import { AccessTokenPayload } from "../types/auth-user";

/**
 * Runs after JwtAuthGuard. A route with no @RequirePermission() is only
 * gated by authentication (JwtAuthGuard) — this guard is a no-op for it.
 * A route that declares @RequirePermission(module, resource, action) is
 * denied unless the caller's active role (from their access token) has
 * that exact permission, checked fresh against the database on every
 * request rather than trusted from the token — so revoking a permission
 * takes effect immediately, not only after the token expires.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: AccessTokenPayload | undefined = request.user;
    if (!user) throw new UnauthorizedException();
    if (user.isSuperAdmin) return true;

    if (!user.companyId || !user.roleId) {
      throw new ForbiddenException("No active company selected — call /auth/switch-company first");
    }

    const grantedRoleId = user.roleId;
    const grantedCompanyId = user.companyId;
    const hasPermission = await this.prisma.withTenant(
      { companyId: grantedCompanyId, userId: user.sub },
      async (tx) => {
        const count = await tx.rolePermission.count({
          where: {
            roleId: grantedRoleId,
            permission: { module: required.module, resource: required.resource, action: required.action },
          },
        });
        return count > 0;
      },
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${required.module}.${required.resource}.${required.action}`);
    }
    return true;
  }
}
