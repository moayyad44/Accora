import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Decimal from "decimal.js";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryApi, type StockBalance } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";

export function StockBalancesPage() {
  const { t } = useTranslation();
  const [warehouseId, setWarehouseId] = React.useState<string>("all");

  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });
  const balancesQuery = useQuery({
    queryKey: ["inventory", "stock-balances", warehouseId],
    queryFn: () => inventoryApi.stockBalances.list(warehouseId === "all" ? undefined : warehouseId),
  });

  const totalValue = (balancesQuery.data ?? []).reduce(
    (sum, b) => sum.plus(new Decimal(b.qtyOnHand).times(b.avgCost)),
    new Decimal(0),
  );

  const columns: ColumnDef<StockBalance>[] = [
    { id: "sku", header: t("catalog.sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
    { id: "name", header: t("accounting.name"), cell: ({ row }) => row.original.item.name },
    { id: "warehouse", header: t("inventory.warehouse"), cell: ({ row }) => row.original.warehouse.name },
    {
      id: "qtyOnHand",
      header: t("inventory.qtyOnHand"),
      cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.qtyOnHand, 4)}</span>,
    },
    {
      id: "avgCost",
      header: t("inventory.avgCost"),
      cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.avgCost)}</span>,
    },
    {
      id: "stockValue",
      header: t("inventory.stockValue"),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums text-foreground">
          {formatAmount(new Decimal(row.original.qtyOnHand).times(row.original.avgCost).toString())}
        </span>
      ),
    },
    {
      id: "card",
      header: "",
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm">
          <Link to={`/inventory/items/${row.original.itemId}/card`}>{t("inventory.viewCard")}</Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("inventory.stockBalances")}
        description={t("inventory.stockBalancesDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("inventory.stockBalances") }]}
        actions={
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inventory.allWarehouses")}</SelectItem>
              {warehousesQuery.data?.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {balancesQuery.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {balancesQuery.error instanceof ApiError && balancesQuery.error.status === 403
            ? t("common.forbiddenBody")
            : t("common.errorGeneric")}
        </Alert>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={balancesQuery.data ?? []}
            isLoading={balancesQuery.isPending}
            searchPlaceholder={t("common.search")}
          />
          {!balancesQuery.isPending && (balancesQuery.data?.length ?? 0) > 0 && (
            <div className="mt-3 flex justify-end text-sm">
              <span className="text-muted">
                {t("inventory.totalStockValue")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">{formatAmount(totalValue.toString())}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
