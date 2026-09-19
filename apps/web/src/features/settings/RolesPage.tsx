import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { settingsApi, type Role } from "@/api/settings";
import { ApiError } from "@/api/client";

function groupPermissions(permissions: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const p of permissions) {
    const module = p.split(".")[0] ?? p;
    (groups[module] ??= []).push(p);
  }
  return groups;
}

export function RolesPage() {
  const { t } = useTranslation();
  const [viewingRole, setViewingRole] = React.useState<Role | null>(null);

  const query = useQuery({ queryKey: ["settings", "roles"], queryFn: settingsApi.roles.list });

  const columns: ColumnDef<Role>[] = [
    { accessorKey: "name", header: t("settings.roleName") },
    {
      id: "isSystem",
      header: t("settings.roleKind"),
      cell: ({ row }) => (
        <Badge variant={row.original.isSystem ? "info" : "neutral"}>
          {row.original.isSystem ? t("settings.systemRole") : t("settings.customRole")}
        </Badge>
      ),
    },
    {
      id: "permissionCount",
      header: t("settings.permissionCount"),
      cell: ({ row }) => <span className="tabular-nums">{row.original.permissions.length}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setViewingRole(row.original)}>
          <Eye className="size-4" />
          {t("settings.viewPermissions")}
        </Button>
      ),
    },
  ];

  const groups = viewingRole ? groupPermissions(viewingRole.permissions) : {};

  return (
    <div>
      <PageHeader
        title={t("nav.roles")}
        description={t("settings.rolesDesc")}
        breadcrumbs={[{ label: t("nav.settings") }, { label: t("nav.roles") }]}
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}

      <Dialog open={!!viewingRole} onOpenChange={(open) => !open && setViewingRole(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{viewingRole?.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {Object.entries(groups).map(([module, perms]) => (
              <div key={module}>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted">{module}</p>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p) => (
                    <Badge key={p} variant="neutral">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
