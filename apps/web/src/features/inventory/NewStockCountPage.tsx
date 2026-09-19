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
import { inventoryApi } from "@/api/inventory";
import { ApiError } from "@/api/client";

const schema = z.object({
  warehouseId: z.string().min(1),
  type: z.enum(["PERIODIC", "SURPRISE"]),
  countDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function NewStockCountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "PERIODIC", countDate: new Date().toISOString().slice(0, 10) },
  });

  const mutation = useMutation({
    mutationFn: inventoryApi.stockCounts.create,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
      toast({ title: t("inventory.countCreated"), variant: "success" });
      navigate(`/inventory/stock-counts/${count.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  if (warehousesQuery.isPending) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        title={t("inventory.newStockCount")}
        breadcrumbs={[
          { label: t("nav.inventory") },
          { label: t("inventory.stockCounts"), to: "/inventory/stock-counts" },
          { label: t("inventory.newStockCount") },
        ]}
      />

      <form onSubmit={form.handleSubmit((v) => { setServerError(null); mutation.mutate(v); })}>
        <Card className="max-w-lg">
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

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

            <FormField label={t("inventory.countType")} htmlFor="type">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERIODIC">{t("inventory.countType_PERIODIC")}</SelectItem>
                      <SelectItem value="SURPRISE">{t("inventory.countType_SURPRISE")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label={t("inventory.countDate")} htmlFor="countDate" error={form.formState.errors.countDate?.message}>
              <Input id="countDate" type="date" {...form.register("countDate")} />
            </FormField>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/inventory/stock-counts")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t("inventory.newStockCount")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
