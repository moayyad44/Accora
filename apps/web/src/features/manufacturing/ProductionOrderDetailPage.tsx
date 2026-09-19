import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { manufacturingApi, type ProductionOrderStatus } from "@/api/manufacturing";
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

const completeSchema = z.object({
  actualQty: z.string().min(1),
  laborCost: z.string().optional(),
  overheadCost: z.string().optional(),
  outputBatchNumber: z.string().optional(),
  outputSerialNumbers: z.string().optional(),
});
type CompleteFormValues = z.infer<typeof completeSchema>;

export function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["manufacturing", "production-orders", id],
    queryFn: () => manufacturingApi.productionOrders.get(id!),
    enabled: !!id,
  });

  const completeForm = useForm<CompleteFormValues>({ resolver: zodResolver(completeSchema) });

  const releaseMutation = useMutation({
    mutationFn: () => manufacturingApi.productionOrders.release(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "production-orders"] });
      toast({ title: t("manufacturing.orderReleased"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const completeMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof manufacturingApi.productionOrders.complete>[1] }) =>
      manufacturingApi.productionOrders.complete(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "production-orders"] });
      toast({ title: t("manufacturing.orderCompleted"), variant: "success" });
      setCompleteOpen(false);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const handleRelease = async () => {
    const ok = await confirm({
      title: t("manufacturing.releaseConfirmTitle"),
      description: t("manufacturing.releaseConfirmBody"),
      confirmLabel: t("manufacturing.releaseOrder"),
    });
    if (ok) releaseMutation.mutate();
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

  const order = query.data;
  const isTrackedSerial = order.item.trackingType === "SERIAL";
  const isTrackedBatch = order.item.trackingType === "BATCH";

  const onCompleteSubmit = (values: CompleteFormValues) => {
    setServerError(null);
    completeMutation.mutate({
      id: id!,
      input: {
        actualQty: values.actualQty,
        laborCost: values.laborCost || undefined,
        overheadCost: values.overheadCost || undefined,
        outputSerialNumbers: isTrackedSerial
          ? (values.outputSerialNumbers ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        outputBatch: isTrackedBatch && values.outputBatchNumber ? { batchNumber: values.outputBatchNumber } : undefined,
      },
    });
  };

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        breadcrumbs={[
          { label: t("nav.manufacturing") },
          { label: t("manufacturing.productionOrders"), to: "/manufacturing/production-orders" },
          { label: order.orderNumber },
        ]}
        actions={
          <>
            {order.status === "DRAFT" && hasPermission("manufacturing.production_order.post") && (
              <Button onClick={handleRelease} loading={releaseMutation.isPending}>
                {t("manufacturing.releaseOrder")}
              </Button>
            )}
            {order.status === "IN_PROGRESS" && hasPermission("manufacturing.production_order.post") && (
              <Button
                onClick={() => {
                  setServerError(null);
                  completeForm.reset({ actualQty: order.plannedQty, laborCost: "", overheadCost: "" });
                  setCompleteOpen(true);
                }}
              >
                {t("manufacturing.completeOrder")}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("manufacturing.outputItem")}</p>
            <p className="text-sm font-medium text-foreground">
              {order.item.sku} — {order.item.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("manufacturing.warehouse")}</p>
            <p className="text-sm font-medium text-foreground">{order.warehouse.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("manufacturing.bom")}</p>
            <Link to={`/manufacturing/boms/${order.bomId}`} className="text-sm font-medium text-primary hover:underline">
              v{order.bom.version}
            </Link>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[order.status]}>{t(`manufacturing.status_${order.status}`)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted">{t("manufacturing.plannedQty")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(order.plannedQty, 4)}</p>
          </div>
          {order.startDate && (
            <div>
              <p className="text-xs text-muted">{t("accounting.startDate")}</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.startDate)}</p>
            </div>
          )}
          {order.endDate && (
            <div>
              <p className="text-xs text-muted">{t("accounting.endDate")}</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.endDate)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {order.materialConsumptions.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("manufacturing.materialConsumptions")}</h3>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("catalog.sku")}</TableHead>
                  <TableHead>{t("accounting.name")}</TableHead>
                  <TableHead className="text-end">{t("sales.qty")}</TableHead>
                  <TableHead className="text-end">{t("manufacturing.unitCost")}</TableHead>
                  <TableHead className="text-end">{t("manufacturing.lineTotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.materialConsumptions.map((mc) => (
                  <TableRow key={mc.id}>
                    <TableCell className="font-mono text-xs">{mc.item.sku}</TableCell>
                    <TableCell>{mc.item.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(mc.qty, 4)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(mc.unitCost)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatAmount(new Decimal(mc.qty).times(mc.unitCost).toString())}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {order.outputs.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("manufacturing.outputs")}</h3>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("catalog.sku")}</TableHead>
                  <TableHead>{t("accounting.name")}</TableHead>
                  <TableHead className="text-end">{t("sales.qty")}</TableHead>
                  <TableHead className="text-end">{t("manufacturing.unitCost")}</TableHead>
                  <TableHead className="text-end">{t("manufacturing.lineTotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.outputs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.item.sku}</TableCell>
                    <TableCell>{o.item.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(o.qty, 4)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(o.unitCost)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(new Decimal(o.qty).times(o.unitCost).toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {order.costVariances.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("manufacturing.costVariances")}</h3>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("manufacturing.varianceTypeCol")}</TableHead>
                  <TableHead className="text-end">{t("manufacturing.variance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.costVariances.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{t(`manufacturing.varianceType_${v.type}`)}</TableCell>
                    <TableCell
                      className={`text-end tabular-nums ${
                        new Decimal(v.amount).isZero() ? "text-muted" : new Decimal(v.amount).isPositive() ? "text-error" : "text-success"
                      }`}
                    >
                      {new Decimal(v.amount).isPositive() ? "+" : ""}
                      {formatAmount(v.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("manufacturing.completeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("manufacturing.completeConfirmBody")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("manufacturing.actualQty")} htmlFor="actualQty" error={completeForm.formState.errors.actualQty?.message}>
                <Input id="actualQty" inputMode="decimal" {...completeForm.register("actualQty")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("manufacturing.laborCost")} htmlFor="laborCost">
                  <Input id="laborCost" inputMode="decimal" placeholder="0.00" {...completeForm.register("laborCost")} />
                </FormField>
                <FormField label={t("manufacturing.overheadCost")} htmlFor="overheadCost">
                  <Input id="overheadCost" inputMode="decimal" placeholder="0.00" {...completeForm.register("overheadCost")} />
                </FormField>
              </div>
              {isTrackedBatch && (
                <FormField label={t("manufacturing.outputBatchNumber")} htmlFor="outputBatchNumber">
                  <Input id="outputBatchNumber" {...completeForm.register("outputBatchNumber")} />
                </FormField>
              )}
              {isTrackedSerial && (
                <FormField label={t("manufacturing.outputSerialNumbers")} htmlFor="outputSerialNumbers">
                  <textarea
                    id="outputSerialNumbers"
                    rows={4}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    {...completeForm.register("outputSerialNumbers")}
                  />
                </FormField>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompleteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={completeMutation.isPending}>
                {t("manufacturing.completeOrder")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
