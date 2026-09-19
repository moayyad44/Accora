import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, PackageX } from "lucide-react";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { salesApi } from "@/api/sales";
import { partiesApi } from "@/api/parties";
import { catalogApi } from "@/api/catalog";
import { inventoryApi } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";

const lineSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  qty: z.string().min(1),
  unitPrice: z.string().min(1),
});

const schema = z.object({
  customerId: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  kind: z.enum(["CASH", "CREDIT"]),
  lines: z.array(lineSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

function toDecimal(value: string | undefined): Decimal {
  if (!value) return new Decimal(0);
  const d = new Decimal(value.replace(/,/g, "") || 0);
  return d.isNaN() ? new Decimal(0) : d;
}

export function NewSalesInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const customersQuery = useQuery({ queryKey: ["parties", "customers"], queryFn: partiesApi.customers.list });
  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceDate: new Date().toISOString().slice(0, 10),
      kind: "CREDIT",
      lines: [{ itemId: "", warehouseId: "", qty: "1", unitPrice: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watchedLines = form.watch("lines");

  const subtotal = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.qty).times(toDecimal(l.unitPrice))), new Decimal(0));

  const createMutation = useMutation({
    mutationFn: salesApi.invoices.create,
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["sales", "invoices"] });
      toast({ title: t("sales.invoiceCreated"), variant: "success" });
      navigate(`/sales/invoices/${invoice.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    createMutation.mutate({
      customerId: values.customerId,
      invoiceDate: values.invoiceDate,
      dueDate: values.dueDate || undefined,
      kind: values.kind,
      lines: values.lines,
    });
  };

  const isLoading = customersQuery.isPending || itemsQuery.isPending || warehousesQuery.isPending;
  const noItems = !itemsQuery.isPending && (itemsQuery.data?.length ?? 0) === 0;
  const noWarehouses = !warehousesQuery.isPending && (warehousesQuery.data?.length ?? 0) === 0;

  if (isLoading) return <Skeleton className="h-96" />;

  if (noItems || noWarehouses) {
    return (
      <EmptyState
        icon={PackageX}
        title={noItems ? t("sales.noItemsTitle") : t("catalog.noWarehousesTitle")}
        description={noItems ? t("sales.noItemsBody") : t("catalog.noWarehousesBody")}
        action={
          <Button asChild variant="outline">
            <Link to={noItems ? "/inventory/items" : "/inventory/warehouses"}>
              {noItems ? t("catalog.items") : t("catalog.warehouses")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={t("sales.newInvoice")}
        breadcrumbs={[
          { label: t("nav.sales") },
          { label: t("sales.invoices"), to: "/sales/invoices" },
          { label: t("sales.newInvoice") },
        ]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <FormField label={t("sales.customer")} htmlFor="customerId" error={form.formState.errors.customerId?.message}>
                  <Controller
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="customerId">
                          <SelectValue placeholder={t("sales.customer")} />
                        </SelectTrigger>
                        <SelectContent>
                          {customersQuery.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
              <FormField label={t("sales.invoiceDate")} htmlFor="invoiceDate" error={form.formState.errors.invoiceDate?.message}>
                <Input id="invoiceDate" type="date" {...form.register("invoiceDate")} />
              </FormField>
              <FormField label={t("sales.kind")} htmlFor="kind">
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">{t("sales.kind_CASH")}</SelectItem>
                        <SelectItem value="CREDIT">{t("sales.kind_CREDIT")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>

            <div className="mt-2">
              <Label>{t("accounting.lines")}</Label>
              <div className="mt-2 flex flex-col gap-2">
                <div className="hidden gap-2 px-1 text-xs font-semibold uppercase text-muted sm:grid sm:grid-cols-[1fr_1fr_90px_110px_110px_36px]">
                  <span>{t("sales.item")}</span>
                  <span>{t("sales.warehouse")}</span>
                  <span>{t("sales.qty")}</span>
                  <span>{t("sales.unitPrice")}</span>
                  <span>{t("sales.lineTotal")}</span>
                  <span />
                </div>

                {fields.map((field, index) => {
                  const line = watchedLines[index];
                  const lineTotal = toDecimal(line?.qty).times(toDecimal(line?.unitPrice));
                  return (
                    <div
                      key={field.id}
                      data-testid={`sales-line-${index}`}
                      className="grid grid-cols-1 items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_90px_110px_110px_36px] sm:border-0 sm:p-0"
                    >
                      <Controller
                        control={form.control}
                        name={`lines.${index}.itemId`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger>
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
                      <Controller
                        control={form.control}
                        name={`lines.${index}.warehouseId`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("sales.warehouse")} />
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
                      <Input inputMode="decimal" className="text-end tabular-nums" {...form.register(`lines.${index}.qty`)} />
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        className="text-end tabular-nums"
                        {...form.register(`lines.${index}.unitPrice`)}
                      />
                      <span className="flex items-center justify-end text-sm font-medium tabular-nums text-foreground">
                        {formatAmount(lineTotal.toString())}
                      </span>
                      <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                        <Trash2 className="size-4 text-error" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ itemId: "", warehouseId: "", qty: "1", unitPrice: "" })}
              >
                <Plus className="size-4" />
                {t("sales.addLine")}
              </Button>
            </div>

            <div className="mt-2 flex justify-end border-t border-border pt-3 text-sm">
              <span className="text-muted">
                {t("sales.subtotal")}: <span className="font-semibold tabular-nums text-foreground">{formatAmount(subtotal.toString())}</span>
              </span>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/sales/invoices")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              {t("sales.createInvoice")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
