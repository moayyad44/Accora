import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { ListAuditLogDto } from "./dto/list-audit-log.dto";

@Controller("audit-logs")
export class AuditLogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @RequirePermission("core", "audit_log", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: ListAuditLogDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.auditLogService.list(tx, companyId, {
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      }),
    );
  }
}
