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
import { inventoryApi, type StockCount, type StockCountStatus } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<StockCountStatus, "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "warning",
  POSTED: "success",
};

export function StockCountsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const query = useQuery({ queryKey: ["inventory", "stock-counts"], queryFn: inventoryApi.stockCounts.list });

  const columns: ColumnDef<StockCount>[] = [
    { accessorKey: "countNumber", header: t("inventory.countNumber") },
    { id: "warehouse", header: t("inventory.warehouse"), cell: ({ row }) => row.original.warehouse.name },
    { id: "countDate", header: t("inventory.countDate"), cell: ({ row }) => formatDate(row.original.countDate) },
    { id: "type", header: t("inventory.countType"), cell: ({ row }) => t(`inventory.countType_${row.original.type}`) },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`inventory.countStatus_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("inventory.stockCounts")}
        description={t("inventory.stockCountsDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("inventory.stockCounts") }]}
        actions={
          hasPermission("inventory.stock_count.create") && (
            <Button asChild>
              <Link to="/inventory/stock-counts/new">
                <Plus className="size-4" />
                {t("inventory.newStockCount")}
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
          onRowClick={(row) => navigate(`/inventory/stock-counts/${row.id}`)}
        />
      )}
    </div>
  );
}
