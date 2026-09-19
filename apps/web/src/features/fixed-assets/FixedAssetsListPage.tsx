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
import { fixedAssetsApi, type FixedAsset, type FixedAssetStatus } from "@/api/fixed-assets";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<FixedAssetStatus, "success" | "error" | "warning"> = {
  ACTIVE: "success",
  DISPOSED: "error",
  FULLY_DEPRECIATED: "warning",
};

export function FixedAssetsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [status, setStatus] = React.useState<string>("all");

  const query = useQuery({
    queryKey: ["fixed-assets", "assets", status],
    queryFn: () => fixedAssetsApi.assets.list(status === "all" ? undefined : (status as FixedAssetStatus)),
  });

  const columns: ColumnDef<FixedAsset>[] = [
    { accessorKey: "assetNumber", header: t("fixedAssets.assetNumber") },
    { accessorKey: "name", header: t("accounting.name") },
    { id: "category", header: t("fixedAssets.category"), cell: ({ row }) => row.original.category.name },
    { id: "cost", header: t("fixedAssets.cost"), cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.cost)}</span> },
    { id: "purchaseDate", header: t("fixedAssets.purchaseDate"), cell: ({ row }) => formatDate(row.original.purchaseDate) },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`fixedAssets.status_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("fixedAssets.assets")}
        description={t("fixedAssets.assetsDesc")}
        breadcrumbs={[{ label: t("nav.fixedAssets") }, { label: t("fixedAssets.assets") }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("manufacturing.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("fixedAssets.status_ACTIVE")}</SelectItem>
                <SelectItem value="DISPOSED">{t("fixedAssets.status_DISPOSED")}</SelectItem>
                <SelectItem value="FULLY_DEPRECIATED">{t("fixedAssets.status_FULLY_DEPRECIATED")}</SelectItem>
              </SelectContent>
            </Select>
            {hasPermission("fixed_assets.fixed_asset.create") && (
              <Button asChild>
                <Link to="/fixed-assets/assets/new">
                  <Plus className="size-4" />
                  {t("fixedAssets.registerAsset")}
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
          onRowClick={(row) => navigate(`/fixed-assets/assets/${row.id}`)}
        />
      )}
    </div>
  );
}
