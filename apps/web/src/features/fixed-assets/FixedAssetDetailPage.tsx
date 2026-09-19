import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { fixedAssetsApi, type FixedAssetStatus } from "@/api/fixed-assets";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<FixedAssetStatus, "success" | "error" | "warning"> = {
  ACTIVE: "success",
  DISPOSED: "error",
  FULLY_DEPRECIATED: "warning",
};

const disposeSchema = z.object({
  disposalDate: z.string().min(1),
  proceeds: z.string().optional(),
  proceedsAccountId: z.string().optional(),
  notes: z.string().optional(),
});
type DisposeFormValues = z.infer<typeof disposeSchema>;

export function FixedAssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [disposeOpen, setDisposeOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["fixed-assets", "assets", id],
    queryFn: () => fixedAssetsApi.assets.get(id!),
    enabled: !!id,
  });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const disposeForm = useForm<DisposeFormValues>({
    resolver: zodResolver(disposeSchema),
    defaultValues: { disposalDate: new Date().toISOString().slice(0, 10) },
  });
  const proceeds = disposeForm.watch("proceeds");

  const disposeMutation = useMutation({
    mutationFn: (v: DisposeFormValues) =>
      fixedAssetsApi.assets.dispose(id!, {
        disposalDate: v.disposalDate,
        proceeds: v.proceeds || undefined,
        proceedsAccountId: v.proceeds ? v.proceedsAccountId : undefined,
        notes: v.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", "assets", id] });
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", "assets"] });
      toast({ title: t("fixedAssets.assetDisposed"), variant: "success" });
      setDisposeOpen(false);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

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

  const asset = query.data;
  const accumulatedDepreciation = asset.depreciationSchedules.reduce((sum, s) => sum.plus(s.amount), new Decimal(0));
  const netBookValue = new Decimal(asset.cost).minus(accumulatedDepreciation);
  const canDispose = asset.status !== "DISPOSED" && hasPermission("fixed_assets.fixed_asset.post");

  return (
    <div>
      <PageHeader
        title={`${asset.assetNumber} — ${asset.name}`}
        breadcrumbs={[
          { label: t("nav.fixedAssets") },
          { label: t("fixedAssets.assets"), to: "/fixed-assets/assets" },
          { label: asset.assetNumber },
        ]}
        actions={
          canDispose && (
            <Button
              variant="danger"
              onClick={() => {
                setServerError(null);
                disposeForm.reset({ disposalDate: new Date().toISOString().slice(0, 10) });
                setDisposeOpen(true);
              }}
            >
              {t("fixedAssets.disposeAsset")}
            </Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.category")}</p>
            <p className="text-sm font-medium text-foreground">{asset.category.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[asset.status]}>{t(`fixedAssets.status_${asset.status}`)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.purchaseDate")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(asset.purchaseDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.depreciationMethod")}</p>
            <p className="text-sm font-medium text-foreground">{t(`fixedAssets.method_${asset.depreciationMethod}`)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.cost")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(asset.cost)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.salvageValue")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(asset.salvageValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.accumulatedDepreciation")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(accumulatedDepreciation.toString())}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("fixedAssets.netBookValue")}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{formatAmount(netBookValue.toString())}</p>
          </div>
        </CardContent>
      </Card>

      {asset.depreciationSchedules.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("fixedAssets.depreciationSchedule")}</h3>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fixedAssets.period")}</TableHead>
                  <TableHead className="text-end">{t("fixedAssets.amount")}</TableHead>
                  <TableHead className="text-end">{t("fixedAssets.accumulated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.depreciationSchedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.period.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(s.amount)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(s.accumulated)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {asset.transactions.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("fixedAssets.transactions")}</h3>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fixedAssets.transactionDate")}</TableHead>
                  <TableHead>{t("fixedAssets.transactionType")}</TableHead>
                  <TableHead className="text-end">{t("fixedAssets.amount")}</TableHead>
                  <TableHead>{t("fixedAssets.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                    <TableCell>{t(`fixedAssets.transactionType_${tx.type}`)}</TableCell>
                    <TableCell className="text-end tabular-nums">{tx.amount ? formatAmount(tx.amount) : "—"}</TableCell>
                    <TableCell className="text-muted">{tx.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("fixedAssets.disposeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("fixedAssets.disposeConfirmBody")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={disposeForm.handleSubmit((v) => { setServerError(null); disposeMutation.mutate(v); })}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("fixedAssets.disposalDate")} htmlFor="disposalDate" error={disposeForm.formState.errors.disposalDate?.message}>
                <Input id="disposalDate" type="date" {...disposeForm.register("disposalDate")} />
              </FormField>
              <FormField label={t("fixedAssets.proceeds")} htmlFor="proceeds">
                <Input id="proceeds" inputMode="decimal" placeholder="0.00" {...disposeForm.register("proceeds")} />
              </FormField>
              {!!proceeds && (
                <FormField
                  label={t("fixedAssets.proceedsAccount")}
                  htmlFor="proceedsAccountId"
                  error={disposeForm.formState.errors.proceedsAccountId?.message}
                >
                  <Controller
                    control={disposeForm.control}
                    name="proceedsAccountId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="proceedsAccountId">
                          <SelectValue placeholder={t("fixedAssets.proceedsAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          {postableAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              )}
              <FormField label={t("fixedAssets.notes")} htmlFor="notes">
                <Input id="notes" {...disposeForm.register("notes")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisposeOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="danger" loading={disposeMutation.isPending}>
                {t("fixedAssets.disposeAsset")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
