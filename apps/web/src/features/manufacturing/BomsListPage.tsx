import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { manufacturingApi, type Bom } from "@/api/manufacturing";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

export function BomsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const query = useQuery({ queryKey: ["manufacturing", "boms"], queryFn: () => manufacturingApi.boms.list() });

  const columns: ColumnDef<Bom>[] = [
    { id: "sku", header: t("catalog.sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
    { id: "name", header: t("manufacturing.outputItem"), cell: ({ row }) => row.original.item.name },
    { id: "version", header: t("manufacturing.version"), cell: ({ row }) => `v${row.original.version}` },
    { id: "lines", header: t("manufacturing.bomLines"), cell: ({ row }) => row.original.lines.length },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "neutral"}>
          {row.original.isActive ? t("accounting.active") : t("accounting.inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("manufacturing.boms")}
        description={t("manufacturing.bomsDesc")}
        breadcrumbs={[{ label: t("nav.manufacturing") }, { label: t("manufacturing.boms") }]}
        actions={
          hasPermission("manufacturing.bom.create") && (
            <Button asChild>
              <Link to="/manufacturing/boms/new">
                <Plus className="size-4" />
                {t("manufacturing.addBom")}
              </Link>
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isPending}
          searchPlaceholder={t("common.search")}
          onRowClick={(row) => navigate(`/manufacturing/boms/${row.id}`)}
        />
      )}
    </div>
  );
}
