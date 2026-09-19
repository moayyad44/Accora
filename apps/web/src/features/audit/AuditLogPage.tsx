import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { auditApi, type AuditLogEntry } from "@/api/audit";
import { ApiError } from "@/api/client";
import { formatDateTime } from "@/lib/format";

export function AuditLogPage() {
  const { t } = useTranslation();
  const [entityType, setEntityType] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [viewingEntry, setViewingEntry] = React.useState<AuditLogEntry | null>(null);

  const query = useQuery({
    queryKey: ["audit-logs", entityType, dateFrom, dateTo],
    queryFn: () => auditApi.list({ entityType: entityType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const columns: ColumnDef<AuditLogEntry>[] = [
    { id: "createdAt", header: t("auditLog.timestamp"), cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { id: "action", header: t("auditLog.action"), cell: ({ row }) => <Badge variant="neutral">{row.original.action}</Badge> },
    { accessorKey: "entityType", header: t("auditLog.entityType") },
    { id: "entityId", header: t("auditLog.entityId"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.entityId.slice(0, 8)}</span> },
    { id: "user", header: t("auditLog.user"), cell: ({ row }) => row.original.user?.fullName ?? t("auditLog.system") },
  ];

  return (
    <div>
      <PageHeader
        title={t("auditLog.auditLog")}
        description={t("auditLog.auditLogDesc")}
        breadcrumbs={[{ label: t("auditLog.auditLog") }]}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="al-entityType">{t("auditLog.entityType")}</Label>
          <Input id="al-entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-48" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="al-dateFrom">{t("accounting.startDate")}</Label>
          <Input id="al-dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-48" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="al-dateTo">{t("accounting.endDate")}</Label>
          <Input id="al-dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-48" />
        </div>
      </div>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} onRowClick={(row) => setViewingEntry(row)} />
      )}

      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {viewingEntry?.action} — {viewingEntry?.entityType}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
            {viewingEntry && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">{t("auditLog.user")}</p>
                    <p>{viewingEntry.user?.fullName ?? t("auditLog.system")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">{t("auditLog.timestamp")}</p>
                    <p>{formatDateTime(viewingEntry.createdAt)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase text-muted">{t("auditLog.before")}</p>
                    <pre dir="ltr" className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 text-start text-xs">
                      {viewingEntry.before ? JSON.stringify(viewingEntry.before, null, 2) : t("auditLog.noChanges")}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase text-muted">{t("auditLog.after")}</p>
                    <pre dir="ltr" className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 text-start text-xs">
                      {viewingEntry.after ? JSON.stringify(viewingEntry.after, null, 2) : t("auditLog.noChanges")}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
