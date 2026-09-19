import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { settingsApi, type CompanyUser } from "@/api/settings";
import { ApiError } from "@/api/client";

export function UsersPage() {
  const { t } = useTranslation();

  const query = useQuery({ queryKey: ["settings", "users"], queryFn: settingsApi.users.list });

  const columns: ColumnDef<CompanyUser>[] = [
    { accessorKey: "fullName", header: t("settings.fullName") },
    { accessorKey: "email", header: t("settings.email") },
    { accessorKey: "roleName", header: t("settings.role") },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav.users")}
        description={t("settings.usersDesc")}
        breadcrumbs={[{ label: t("nav.settings") }, { label: t("nav.users") }]}
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}
    </div>
  );
}
