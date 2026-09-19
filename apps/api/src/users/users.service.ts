import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class UsersService {
  async me(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, fullNameAr: true, isSuperAdmin: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
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
