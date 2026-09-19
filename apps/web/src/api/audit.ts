import { api } from "./client";

export interface AuditLogEntry {
  id: string;
  companyId: string | null;
  userId: string | null;
  user: { id: string; fullName: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ListAuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildQuery(filters: ListAuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const auditApi = {
  list: (filters: ListAuditLogFilters = {}) => api.get<AuditLogEntry[]>(`/audit-logs${buildQuery(filters)}`),
};
