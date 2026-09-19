import * as React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { manufacturingApi, type ProductionOrder, type ProductionOrderStatus } from "@/api/manufacturing";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<ProductionOrderStatus, "neutral" | "info" | "success" | "error" | "warning"> = {
  DRAFT: "neutral",
  RELEASED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "error",
};

export function ProductionOrdersListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [status, setStatus] = React.useState<string>("all");

  const query = useQuery({
    queryKey: ["manufacturing", "production-orders", status],
    queryFn: () => manufacturingApi.productionOrders.list(status === "all" ? undefined : (status as ProductionOrderStatus)),
  });

  const columns: ColumnDef<ProductionOrder>[] = [
    { accessorKey: "orderNumber", header: t("manufacturing.orderNumber") },
    { id: "sku", header: t("catalog.sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
    { id: "item", header: t("manufacturing.outputItem"), cell: ({ row }) => row.original.item.name },
    { id: "warehouse", header: t("manufacturing.warehouse"), cell: ({ row }) => row.original.warehouse.name },
    {
      id: "plannedQty",
      header: t("manufacturing.plannedQty"),
      cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.plannedQty, 4)}</span>,
    },
    { id: "startDate", header: t("accounting.startDate"), cell: ({ row }) => (row.original.startDate ? formatDate(row.original.startDate) : "—") },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`manufacturing.status_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("manufacturing.productionOrders")}
        description={t("manufacturing.productionOrdersDesc")}
        breadcrumbs={[{ label: t("nav.manufacturing") }, { label: t("manufacturing.productionOrders") }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("manufacturing.allStatuses")}</SelectItem>
                <SelectItem value="DRAFT">{t("manufacturing.status_DRAFT")}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t("manufacturing.status_IN_PROGRESS")}</SelectItem>
                <SelectItem value="COMPLETED">{t("manufacturing.status_COMPLETED")}</SelectItem>
              </SelectContent>
            </Select>
            {hasPermission("manufacturing.production_order.create") && (
              <Button asChild>
                <Link to="/manufacturing/production-orders/new">
                  <Plus className="size-4" />
                  {t("manufacturing.newProductionOrder")}
                </Link>
              </Button>
            )}
          </div>
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
          onRowClick={(row) => navigate(`/manufacturing/production-orders/${row.id}`)}
        />
      )}
    </div>
  );
}
