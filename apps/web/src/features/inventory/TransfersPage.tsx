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
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    qty: z.string().min(1),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    path: ["toWarehouseId"],
    message: "sameWarehouse",
  });
type FormValues = z.infer<typeof schema>;

export function TransfersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { qty: "1" } });

  const mutation = useMutation({
    mutationFn: inventoryApi.transfers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "item-card"] });
      toast({ title: t("inventory.transferSuccess"), variant: "success" });
      form.reset({ itemId: "", fromWarehouseId: "", toWarehouseId: "", qty: "1" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const isLoading = itemsQuery.isPending || warehousesQuery.isPending;
  if (isLoading) return <Skeleton className="h-72" />;

  const toWarehouseError = form.formState.errors.toWarehouseId?.message === "sameWarehouse" ? t("inventory.sameWarehouseError") : undefined;

  return (
    <div>
      <PageHeader
        title={t("inventory.transfers")}
        description={t("inventory.transfersDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("inventory.transfers") }]}
      />

      <form onSubmit={form.handleSubmit((v) => { setServerError(null); mutation.mutate(v); })}>
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("inventory.fromWarehouse")} htmlFor="fromWarehouseId" error={form.formState.errors.fromWarehouseId?.message}>
                <Controller
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="fromWarehouseId">
                        <SelectValue placeholder={t("inventory.fromWarehouse")} />
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

              <FormField label={t("inventory.toWarehouse")} htmlFor="toWarehouseId" error={toWarehouseError}>
                <Controller
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="toWarehouseId">
                        <SelectValue placeholder={t("inventory.toWarehouse")} />
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

            <FormField label={t("sales.qty")} htmlFor="qty" error={form.formState.errors.qty?.message}>
              <Input id="qty" inputMode="decimal" className="max-w-xs" {...form.register("qty")} />
            </FormField>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={mutation.isPending}>
              {t("inventory.doTransfer")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
