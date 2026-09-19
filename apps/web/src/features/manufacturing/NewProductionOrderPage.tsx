import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { manufacturingApi } from "@/api/manufacturing";
import { catalogApi } from "@/api/catalog";
import { inventoryApi } from "@/api/inventory";
import { ApiError } from "@/api/client";

const schema = z.object({
  itemId: z.string().min(1),
  plannedQty: z.string().min(1),
  warehouseId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function NewProductionOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });

  const manufacturedItems = (itemsQuery.data ?? []).filter(
    (i) => i.itemType === "SEMI_FINISHED" || i.itemType === "FINISHED_GOOD",
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { plannedQty: "1" } });

  const createMutation = useMutation({
    mutationFn: manufacturingApi.productionOrders.create,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "production-orders"] });
      toast({ title: t("manufacturing.orderCreated"), variant: "success" });
      navigate(`/manufacturing/production-orders/${order.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const isLoading = itemsQuery.isPending || warehousesQuery.isPending;
  if (isLoading) return <Skeleton className="h-72" />;

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    createMutation.mutate({
      itemId: values.itemId,
      plannedQty: values.plannedQty,
      warehouseId: values.warehouseId,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title={t("manufacturing.newProductionOrder")}
        breadcrumbs={[
          { label: t("nav.manufacturing") },
          { label: t("manufacturing.productionOrders"), to: "/manufacturing/production-orders" },
          { label: t("manufacturing.newProductionOrder") },
        ]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            {manufacturedItems.length === 0 && <Alert variant="warning">{t("manufacturing.onlyManufacturedItems")}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("manufacturing.outputItem")} htmlFor="itemId" error={form.formState.errors.itemId?.message}>
                <Controller
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="itemId">
                        <SelectValue placeholder={t("manufacturing.outputItem")} />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturedItems.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.sku} — {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label={t("manufacturing.warehouse")} htmlFor="warehouseId" error={form.formState.errors.warehouseId?.message}>
                <Controller
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="warehouseId">
                        <SelectValue placeholder={t("manufacturing.warehouse")} />
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
              <FormField label={t("manufacturing.plannedQty")} htmlFor="plannedQty" error={form.formState.errors.plannedQty?.message}>
                <Input id="plannedQty" inputMode="decimal" {...form.register("plannedQty")} />
              </FormField>
              <FormField label={t("accounting.startDate")} htmlFor="startDate">
                <Input id="startDate" type="date" {...form.register("startDate")} />
              </FormField>
              <FormField label={t("accounting.endDate")} htmlFor="endDate">
                <Input id="endDate" type="date" {...form.register("endDate")} />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/manufacturing/production-orders")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={manufacturedItems.length === 0}>
              {t("manufacturing.newProductionOrder")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
