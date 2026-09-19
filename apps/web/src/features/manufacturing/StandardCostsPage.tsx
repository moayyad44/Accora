import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { manufacturingApi } from "@/api/manufacturing";
import { catalogApi } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  materialCost: z.string().min(1),
  laborCost: z.string().min(1),
  overheadCost: z.string().min(1),
  effectiveDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function StandardCostsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [itemId, setItemId] = React.useState<string>("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const costsQuery = useQuery({
    queryKey: ["manufacturing", "standard-costs", itemId],
    queryFn: () => manufacturingApi.standardCosts.list(itemId),
    enabled: !!itemId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { effectiveDate: new Date().toISOString().slice(0, 10) },
  });

  const setCostMutation = useMutation({
    mutationFn: manufacturingApi.standardCosts.set,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "standard-costs", itemId] });
      toast({ title: t("manufacturing.standardCostSet"), variant: "success" });
      setDialogOpen(false);
      form.reset({ effectiveDate: new Date().toISOString().slice(0, 10) });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  if (itemsQuery.isPending) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        title={t("manufacturing.standardCosts")}
        description={t("manufacturing.standardCostsDesc")}
        breadcrumbs={[{ label: t("nav.manufacturing") }, { label: t("manufacturing.standardCosts") }]}
        actions={
          itemId &&
          hasPermission("manufacturing.standard_cost.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ effectiveDate: new Date().toISOString().slice(0, 10) });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("manufacturing.setStandardCost")}
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-sm">
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger>
            <SelectValue placeholder={t("manufacturing.selectItem")} />
          </SelectTrigger>
          <SelectContent>
            {itemsQuery.data?.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.sku} — {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!itemId ? (
        <EmptyState title={t("manufacturing.selectItemToViewCosts")} />
      ) : costsQuery.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {costsQuery.error instanceof ApiError && costsQuery.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : costsQuery.isPending ? (
        <Skeleton className="h-40" />
      ) : (costsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("common.noData")} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("manufacturing.effectiveDate")}</TableHead>
                <TableHead className="text-end">{t("manufacturing.materialCost")}</TableHead>
                <TableHead className="text-end">{t("manufacturing.laborCost")}</TableHead>
                <TableHead className="text-end">{t("manufacturing.overheadCost")}</TableHead>
                <TableHead className="text-end">{t("manufacturing.totalStandardCost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costsQuery.data?.map((c) => {
                const total = new Decimal(c.materialCost).plus(c.laborCost).plus(c.overheadCost);
                return (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.effectiveDate)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(c.materialCost)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(c.laborCost)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(c.overheadCost)}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums text-foreground">{formatAmount(total.toString())}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("manufacturing.setStandardCost")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => {
              setServerError(null);
              setCostMutation.mutate({ itemId, ...v });
            })}
          >
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("manufacturing.materialCost")} htmlFor="materialCost" error={form.formState.errors.materialCost?.message}>
                <Input id="materialCost" inputMode="decimal" placeholder="0.00" {...form.register("materialCost")} />
              </FormField>
              <FormField label={t("manufacturing.laborCost")} htmlFor="laborCost" error={form.formState.errors.laborCost?.message}>
                <Input id="laborCost" inputMode="decimal" placeholder="0.00" {...form.register("laborCost")} />
              </FormField>
              <FormField label={t("manufacturing.overheadCost")} htmlFor="overheadCost" error={form.formState.errors.overheadCost?.message}>
                <Input id="overheadCost" inputMode="decimal" placeholder="0.00" {...form.register("overheadCost")} />
              </FormField>
              <FormField label={t("manufacturing.effectiveDate")} htmlFor="effectiveDate" error={form.formState.errors.effectiveDate?.message}>
                <Input id="effectiveDate" type="date" {...form.register("effectiveDate")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={setCostMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
