import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryApi, type StockMoveType } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatAmount, formatDateTime } from "@/lib/format";

const MOVE_VARIANT: Record<StockMoveType, "success" | "error" | "info" | "warning"> = {
  IN: "success",
  OUT: "error",
  TRANSFER_IN: "info",
  TRANSFER_OUT: "info",
  ADJUSTMENT_IN: "warning",
  ADJUSTMENT_OUT: "warning",
};

export function ItemCardPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t } = useTranslation();
  const [warehouseId, setWarehouseId] = React.useState<string>("all");

  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });
  const cardQuery = useQuery({
    queryKey: ["inventory", "item-card", itemId, warehouseId],
    queryFn: () => inventoryApi.itemCard(itemId!, warehouseId === "all" ? undefined : warehouseId),
    enabled: !!itemId,
  });

  if (cardQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (cardQuery.isError) {
    return (
      <Alert variant="error" title={t("common.errorTitle")}>
        {cardQuery.error instanceof ApiError && cardQuery.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
      </Alert>
    );
  }

  const card = cardQuery.data;

  return (
    <div>
      <PageHeader
        title={`${t("inventory.itemCard")} — ${card.item.sku} ${card.item.name}`}
        description={t("inventory.itemCardDesc")}
        breadcrumbs={[
          { label: t("nav.inventory") },
          { label: t("inventory.stockBalances"), to: "/inventory/stock-balances" },
          { label: card.item.sku },
        ]}
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

      {card.rows.length === 0 ? (
        <EmptyState title={t("common.noData")} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inventory.moveDate")}</TableHead>
                <TableHead>{t("inventory.warehouse")}</TableHead>
                <TableHead>{t("inventory.moveType")}</TableHead>
                <TableHead>{t("inventory.source")}</TableHead>
                <TableHead className="text-end">{t("sales.qty")}</TableHead>
                <TableHead className="text-end">{t("inventory.avgCost")}</TableHead>
                <TableHead className="text-end">{t("inventory.runningQty")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDateTime(row.moveDate)}</TableCell>
                  <TableCell>{row.warehouse}</TableCell>
                  <TableCell>
                    <Badge variant={MOVE_VARIANT[row.moveType]}>{t(`inventory.moveType_${row.moveType}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted">{t(`inventory.moveSource_${row.sourceType}`)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row.qty, 4)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row.unitCost)}</TableCell>
                  <TableCell className="text-end font-medium tabular-nums text-foreground">{formatAmount(row.runningQty, 4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
