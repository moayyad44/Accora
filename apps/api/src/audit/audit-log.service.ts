import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface RecordAuditLogInput {
  /** Null only for pre-company-selection events (e.g. a login, before the
   * user has picked which company to work in) — matches AuditLog.companyId
   * being nullable for exactly that case. */
  companyId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

export interface ListAuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Writes the immutable audit trail (docs/ARCHITECTURE.md — security §).
 * Deliberately a thin, generic helper rather than a "log everything"
 * interceptor: callers state exactly what happened (action/entityType/
 * entityId/before/after) so entries stay meaningful and queryable, not a
 * firehose of framework noise. Wired into JournalEntriesService.post()/
 * reverse() — the sole posting choke point every financial document in
 * this system already goes through — which gives blanket coverage of
 * every posted transaction without touching each module individually,
 * plus login and RBAC-sensitive changes (user/role edits) called out
 * explicitly since those aren't financial postings.
 */
@Injectable()
export class AuditLogService {
  async record(tx: Prisma.TransactionClient, input: RecordAuditLogInput) {
    return tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
        after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
        ipAddress: input.ipAddress,
      },
    });
  }

  async list(tx: Prisma.TransactionClient, companyId: string, filters: ListAuditLogFilters = {}) {
    return tx.auditLog.findMany({
      where: {
        companyId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        userId: filters.userId,
        createdAt: filters.dateFrom || filters.dateTo ? { gte: filters.dateFrom, lte: filters.dateTo } : undefined,
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }
}
