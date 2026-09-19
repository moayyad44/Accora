import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class RolesService {
  async listForCompany(tx: Prisma.TransactionClient, companyId: string) {
    const roles = await tx.role.findMany({
      where: { companyId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => `${rp.permission.module}.${rp.permission.resource}.${rp.permission.action}`),
    }));
  }
}
