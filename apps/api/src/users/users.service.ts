import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const BCRYPT_ROUNDS = 12;

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
   * user_company_access RLS policy, not the userId branch). Includes
   * deactivated users too (unlike most "active" listings elsewhere) so an
   * admin can find and reactivate someone via PATCH /users/:id. */
  async listCompanyUsers(tx: Prisma.TransactionClient, companyId: string) {
    const access = await tx.userCompanyAccess.findMany({
      where: { companyId },
      include: { user: { select: { id: true, email: true, fullName: true } }, role: true },
    });
    return access.map((a) => ({
      userId: a.user.id,
      email: a.user.email,
      fullName: a.user.fullName,
      roleId: a.roleId,
      roleName: a.role.name,
      isActive: a.isActive,
    }));
  }

  /** Grants an employee access to the active company: an existing account
   * (matched by email) is simply linked with the given role, otherwise a
   * brand-new user is created. There's no invite/email flow yet, so the
   * admin sets the initial password directly and passes it to the employee
   * out of band — same pattern as AuthService.registerCompany. */
  async createCompanyUser(tx: Prisma.TransactionClient, companyId: string, dto: CreateUserDto) {
    const role = await tx.role.findFirst({ where: { id: dto.roleId, companyId } });
    if (!role) throw new BadRequestException("Role not found in this company");

    const existing = await tx.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      const existingAccess = await tx.userCompanyAccess.findFirst({ where: { userId: existing.id, companyId } });
      if (existingAccess?.isActive) throw new BadRequestException("This email already has access to this company");

      if (existingAccess) {
        await tx.userCompanyAccess.update({
          where: { id: existingAccess.id },
          data: { roleId: dto.roleId, isActive: true },
        });
      } else {
        await tx.userCompanyAccess.create({ data: { userId: existing.id, companyId, roleId: dto.roleId } });
      }

      return {
        userId: existing.id,
        email: existing.email,
        fullName: existing.fullName,
        roleId: dto.roleId,
        roleName: role.name,
        isActive: true,
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await tx.user.create({ data: { email: dto.email, passwordHash, fullName: dto.fullName } });
    await tx.userCompanyAccess.create({ data: { userId: user.id, companyId, roleId: dto.roleId } });

    return { userId: user.id, email: user.email, fullName: user.fullName, roleId: dto.roleId, roleName: role.name, isActive: true };
  }

  /** Updates an employee's role and/or active status within the active
   * company. Never touches the global User row — deactivating here only
   * revokes access to this specific company, other companies (if any) are
   * unaffected. */
  async updateCompanyUser(tx: Prisma.TransactionClient, companyId: string, targetUserId: string, dto: UpdateUserDto) {
    const access = await tx.userCompanyAccess.findFirst({ where: { userId: targetUserId, companyId } });
    if (!access) throw new NotFoundException("User not found in this company");

    if (dto.roleId) {
      const role = await tx.role.findFirst({ where: { id: dto.roleId, companyId } });
      if (!role) throw new BadRequestException("Role not found in this company");
    }

    const updated = await tx.userCompanyAccess.update({
      where: { id: access.id },
      data: { roleId: dto.roleId, isActive: dto.isActive },
      include: { user: { select: { id: true, email: true, fullName: true } }, role: true },
    });

    return {
      userId: updated.user.id,
      email: updated.user.email,
      fullName: updated.user.fullName,
      roleId: updated.roleId,
      roleName: updated.role.name,
    };
  }
}
