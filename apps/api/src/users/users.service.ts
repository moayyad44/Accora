import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class UsersService {
  /** `companyId`/`roleId` come from the caller's own access token (see
   * UsersController.me) — never from a request param — so this only ever
   * answers "what can I, the caller, do", the same identity-scoped shape
   * as GET /companies. It exists because GET /roles (the only other place
   * permissions are readable) itself requires core.role.view, which most
   * non-admin users won't have — yet every user needs their own effective
   * permission set to know what the UI should show them. A super admin's
   * permissions are implicitly "everything" (see PermissionsGuard), so we
   * return that as an explicit isSuperAdmin flag rather than enumerating
   * all ~400 permission rows. */
  async me(tx: Prisma.TransactionClient, userId: string, companyId: string | null, roleId: string | null) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, fullNameAr: true, isSuperAdmin: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");

    if (!companyId || !roleId || user.isSuperAdmin) {
      return { ...user, companyId, role: null, permissions: [] as string[] };
    }

    const role = await tx.role.findFirst({
      where: { id: roleId, companyId },
      include: { permissions: { include: { permission: true } } },
    });

    return {
      ...user,
      companyId,
      role: role ? { id: role.id, name: role.name, nameAr: role.nameAr } : null,
      permissions: role
        ? role.permissions.map((rp) => `${rp.permission.module}.${rp.permission.resource}.${rp.permission.action}`)
        : [],
    };
  }

  /** Users with access to the currently active company — an admin-facing
   * listing, hence tenant-scoped (relies on the companyId branch of the
   * user_company_access RLS policy, not the userId branch). */
  async listCompanyUsers(tx: Prisma.TransactionClient, companyId: string) {
    const access = await tx.userCompanyAccess.findMany({
      where: { companyId, isActive: true },
      include: { user: { select: { id: true, email: true, fullName: true } }, role: true },
    });
    return access.map((a) => ({
      userId: a.user.id,
      email: a.user.email,
      fullName: a.user.fullName,
      roleId: a.roleId,
      roleName: a.role.name,
    }));
  }
}
