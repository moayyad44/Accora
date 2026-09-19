import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { inventoryApi } from "@/api/inventory";
import { catalogApi } from "@/api/catalog";
import { ApiError } from "@/api/client";

const schema = z
  .object({
    itemId: z.string().min(1),
    warehouseId: z.string().min(1),
    direction: z.enum(["INCREASE", "DECREASE"]),
    qty: z.string().min(1),
    unitCost: z.string().optional(),
    reason: z.string().min(1),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
  })
  .refine((v) => v.direction !== "INCREASE" || !!v.unitCost, {
    path: ["unitCost"],
    message: "required",
  });
type FormValues = z.infer<typeof schema>;

export function AdjustmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { direction: "INCREASE", qty: "1" },
  });
  const direction = form.watch("direction");

  const mutation = useMutation({
    mutationFn: inventoryApi.adjustments.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "item-card"] });
      toast({ title: t("inventory.adjustmentSuccess"), variant: "success" });
      form.reset({ itemId: "", warehouseId: "", direction: "INCREASE", qty: "1", unitCost: "", reason: "", batchNumber: "", expiryDate: "" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const isLoading = itemsQuery.isPending || warehousesQuery.isPending;
  if (isLoading) return <Skeleton className="h-72" />;

  const unitCostError = form.formState.errors.unitCost?.message === "required" ? t("inventory.unitCostRequiredForIncrease") : undefined;

  return (
    <div>
      <PageHeader
        title={t("inventory.adjustments")}
        description={t("inventory.adjustmentsDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("inventory.adjustments") }]}
      />

      <form
        onSubmit={form.handleSubmit((v) => {
          setServerError(null);
          mutation.mutate({
            itemId: v.itemId,
            warehouseId: v.warehouseId,
            direction: v.direction,
            qty: v.qty,
            unitCost: v.direction === "INCREASE" ? v.unitCost : undefined,
            reason: v.reason,
            batchNumber: v.batchNumber || undefined,
            expiryDate: v.expiryDate || undefined,
          });
        })}
      >
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("sales.item")} htmlFor="itemId" error={form.formState.errors.itemId?.message}>
                <Controller
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="itemId">
                        <SelectValue placeholder={t("sales.item")} />
                      </SelectTrigger>
                      <SelectContent>
                        {itemsQuery.data?.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.sku} — {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label={t("inventory.warehouse")} htmlFor="warehouseId" error={form.formState.errors.warehouseId?.message}>
                <Controller
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="warehouseId">
                        <SelectValue placeholder={t("inventory.warehouse")} />
                      </SelectTrigger>
                      <SelectContent>
                        {warehousesQuery.data?.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.code} — {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label={t("inventory.direction")} htmlFor="direction">
                <Controller
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCREASE">{t("inventory.direction_INCREASE")}</SelectItem>
                        <SelectItem value="DECREASE">{t("inventory.direction_DECREASE")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label={t("sales.qty")} htmlFor="qty" error={form.formState.errors.qty?.message}>
                <Input id="qty" inputMode="decimal" {...form.register("qty")} />
              </FormField>

              {direction === "INCREASE" && (
                <FormField label={t("inventory.avgCost")} htmlFor="unitCost" error={unitCostError}>
                  <Input id="unitCost" inputMode="decimal" placeholder="0.00" {...form.register("unitCost")} />
                </FormField>
              )}
            </div>

            <FormField label={t("inventory.reason")} htmlFor="reason" error={form.formState.errors.reason?.message}>
              <Input id="reason" {...form.register("reason")} />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("inventory.batchNumber")} htmlFor="batchNumber">
                <Input id="batchNumber" {...form.register("batchNumber")} />
              </FormField>
              <FormField label={t("inventory.expiryDate")} htmlFor="expiryDate">
                <Input id="expiryDate" type="date" {...form.register("expiryDate")} />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={mutation.isPending}>
              {t("inventory.doAdjustment")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
