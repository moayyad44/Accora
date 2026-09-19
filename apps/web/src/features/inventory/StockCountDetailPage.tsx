import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { inventoryApi, type StockCountStatus } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<StockCountStatus, "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "warning",
  POSTED: "success",
};

export function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [counted, setCounted] = React.useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["inventory", "stock-counts", id],
    queryFn: () => inventoryApi.stockCounts.get(id!),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (query.data) {
      setCounted(Object.fromEntries(query.data.lines.map((l) => [l.itemId, l.countedQty])));
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      inventoryApi.stockCounts.setCountedQuantities(
        id!,
        Object.entries(counted).map(([itemId, countedQty]) => ({ itemId, countedQty })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts", id] });
      toast({ title: t("inventory.countedSaved"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const postMutation = useMutation({
    mutationFn: () => inventoryApi.stockCounts.post(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-balances"] });
      toast({ title: t("inventory.countPosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handlePost = async () => {
    const ok = await confirm({
      title: t("inventory.postCountConfirmTitle"),
      description: t("inventory.postCountConfirmBody"),
      confirmLabel: t("inventory.postCount"),
      destructive: true,
    });
    if (ok) postMutation.mutate();
  };

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="error" title={t("common.errorTitle")}>
        {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
      </Alert>
    );
  }

  const count = query.data;
  const editable = count.status !== "POSTED" && hasPermission("inventory.stock_count.update");

  return (
    <div>
      <PageHeader
        title={count.countNumber}
        breadcrumbs={[
          { label: t("nav.inventory") },
          { label: t("inventory.stockCounts"), to: "/inventory/stock-counts" },
          { label: count.countNumber },
        ]}
        actions={
          editable && (
            <>
              <Button variant="outline" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                {t("inventory.saveCounted")}
              </Button>
              {hasPermission("inventory.stock_count.post") && (
                <Button onClick={handlePost} loading={postMutation.isPending}>
                  {t("inventory.postCount")}
                </Button>
              )}
            </>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("inventory.warehouse")}</p>
            <p className="text-sm font-medium text-foreground">{count.warehouse.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("inventory.countDate")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(count.countDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("inventory.countType")}</p>
            <p className="text-sm font-medium text-foreground">{t(`inventory.countType_${count.type}`)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[count.status]}>{t(`inventory.countStatus_${count.status}`)}</Badge>
          </div>
        </CardContent>
      </Card>

      {count.lines.length === 0 ? (
        <Alert variant="warning">{t("inventory.noVarianceLines")}</Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("catalog.sku")}</TableHead>
                <TableHead>{t("accounting.name")}</TableHead>
                <TableHead className="text-end">{t("inventory.systemQty")}</TableHead>
                <TableHead className="text-end">{t("inventory.countedQty")}</TableHead>
                <TableHead className="text-end">{t("inventory.variance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {count.lines.map((line) => {
                const countedValue = counted[line.itemId] ?? line.countedQty;
                const variance = new Decimal(countedValue || 0).minus(line.systemQty);
                return (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs">{line.item.sku}</TableCell>
                    <TableCell>{line.item.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(line.systemQty, 4)}</TableCell>
                    <TableCell className="text-end">
                      {editable ? (
                        <Input
                          inputMode="decimal"
                          className="ms-auto w-28 text-end tabular-nums"
                          value={countedValue}
                          onChange={(e) => setCounted((prev) => ({ ...prev, [line.itemId]: e.target.value }))}
                        />
                      ) : (
                        <span className="tabular-nums">{formatAmount(line.countedQty, 4)}</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-end font-medium tabular-nums ${
                        variance.isZero() ? "text-muted" : variance.isPositive() ? "text-success" : "text-error"
                      }`}
                    >
                      {variance.isPositive() ? "+" : ""}
                      {formatAmount(variance.toString(), 4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
