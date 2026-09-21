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
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { purchasingApi } from "@/api/purchasing";
import { partiesApi } from "@/api/parties";
import { catalogApi } from "@/api/catalog";
import { inventoryApi } from "@/api/inventory";
import { taxApi } from "@/api/tax";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { createGridPasteHandler, resolveOptionId, type GridOption } from "@/lib/gridPaste";

const lineSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  qty: z.string().min(1),
  unitCost: z.string().min(1),
  taxGroupId: z.string().optional(),
});

const schema = z.object({
  supplierId: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

function toDecimal(value: string | undefined): Decimal {
  if (!value) return new Decimal(0);
  const d = new Decimal(value.replace(/,/g, "") || 0);
  return d.isNaN() ? new Decimal(0) : d;
}

const emptyLine = { itemId: "", warehouseId: "", qty: "1", unitCost: "", taxGroupId: undefined };

export function NewPurchaseInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const suppliersQuery = useQuery({ queryKey: ["parties", "suppliers"], queryFn: partiesApi.suppliers.list });
  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const warehousesQuery = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });
  const taxGroupsQuery = useQuery({ queryKey: ["tax", "groups"], queryFn: taxApi.groups.list });

  const itemOptions: GridOption[] = (itemsQuery.data ?? []).map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}`, code: i.sku }));
  const warehouseOptions: GridOption[] = (warehousesQuery.data ?? []).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}`, code: w.code }));
  const taxGroupOptions: GridOption[] = [
    { value: "", label: t("tax.noTax") },
    ...(taxGroupsQuery.data ?? []).map((g) => ({ value: g.id, label: g.name })),
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceDate: new Date().toISOString().slice(0, 10),
      lines: [emptyLine],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watchedLines = form.watch("lines");

  const subtotal = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.qty).times(toDecimal(l.unitCost))), new Decimal(0));

  const handlePaste = createGridPasteHandler({
    linesPath: "lines",
    currentRowCount: fields.length,
    appendRow: () => append(emptyLine),
    setValue: (path, value) => form.setValue(path as never, value as never),
    columns: [
      { key: "itemId", resolve: (text) => resolveOptionId(itemOptions, text) ?? "" },
      { key: "warehouseId", resolve: (text) => resolveOptionId(warehouseOptions, text) ?? "" },
      { key: "qty", resolve: (text) => text.trim() },
      { key: "unitCost", resolve: (text) => text.trim() },
      { key: "taxGroupId", resolve: (text) => resolveOptionId(taxGroupOptions, text) ?? "" },
    ],
  });

  const createMutation = useMutation({
    mutationFn: purchasingApi.invoices.create,
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["purchasing", "invoices"] });
      toast({ title: t("purchasing.invoiceCreated"), variant: "success" });
      navigate(`/purchasing/invoices/${invoice.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    createMutation.mutate({
      supplierId: values.supplierId,
      invoiceDate: values.invoiceDate,
      dueDate: values.dueDate || undefined,
      lines: values.lines.map((l) => ({ ...l, taxGroupId: l.taxGroupId || undefined })),
    });
  };

  const isLoading = suppliersQuery.isPending || itemsQuery.isPending || warehousesQuery.isPending;
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
        title={t("purchasing.newInvoice")}
        breadcrumbs={[
          { label: t("nav.purchasing") },
          { label: t("purchasing.invoices"), to: "/purchasing/invoices" },
          { label: t("purchasing.newInvoice") },
        ]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FormField label={t("purchasing.supplier")} htmlFor="supplierId" error={form.formState.errors.supplierId?.message}>
                  <Controller
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="supplierId">
                          <SelectValue placeholder={t("purchasing.supplier")} />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliersQuery.data?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} — {s.name}
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
            </div>

            <div className="mt-2">
              <Label>{t("accounting.lines")}</Label>
              <p className="mb-2 mt-1 text-xs text-muted">{t("common.pasteHint")}</p>

              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px] border-e border-border">{t("sales.item")}</TableHead>
                      <TableHead className="min-w-[160px] border-e border-border">{t("sales.warehouse")}</TableHead>
                      <TableHead className="w-24 border-e border-border">{t("sales.qty")}</TableHead>
                      <TableHead className="w-28 border-e border-border">{t("purchasing.unitCost")}</TableHead>
                      <TableHead className="min-w-[140px] border-e border-border">{t("tax.taxGroup")}</TableHead>
                      <TableHead className="w-28 border-e border-border">{t("sales.lineTotal")}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const line = watchedLines[index];
                      const lineTotal = toDecimal(line?.qty).times(toDecimal(line?.unitCost));
                      return (
                        <TableRow key={field.id} data-testid={`purchase-line-${index}`}>
                          <TableCell className="border-e border-border p-1">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.itemId`}
                              render={({ field: f }) => (
                                <Combobox
                                  value={f.value}
                                  onValueChange={(v) => f.onChange(v ?? "")}
                                  options={itemOptions}
                                  placeholder={t("sales.item")}
                                  noResultsLabel={t("common.noResults")}
                                  onPaste={(e) => handlePaste(e, index, 0)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="border-e border-border p-1">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.warehouseId`}
                              render={({ field: f }) => (
                                <Combobox
                                  value={f.value}
                                  onValueChange={(v) => f.onChange(v ?? "")}
                                  options={warehouseOptions}
                                  placeholder={t("sales.warehouse")}
                                  noResultsLabel={t("common.noResults")}
                                  onPaste={(e) => handlePaste(e, index, 1)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="border-e border-border p-1">
                            <Input
                              inputMode="decimal"
                              className="h-9 border-0 bg-transparent text-end tabular-nums focus-visible:ring-1"
                              {...form.register(`lines.${index}.qty`)}
                              onPaste={(e) => handlePaste(e, index, 2)}
                            />
                          </TableCell>
                          <TableCell className="border-e border-border p-1">
                            <Input
                              inputMode="decimal"
                              placeholder="0.00"
                              className="h-9 border-0 bg-transparent text-end tabular-nums focus-visible:ring-1"
                              {...form.register(`lines.${index}.unitCost`)}
                              onPaste={(e) => handlePaste(e, index, 3)}
                            />
                          </TableCell>
                          <TableCell className="border-e border-border p-1">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.taxGroupId`}
                              render={({ field: f }) => (
                                <Combobox
                                  value={f.value ?? ""}
                                  onValueChange={(v) => f.onChange(v || undefined)}
                                  options={taxGroupOptions}
                                  placeholder={t("tax.noTax")}
                                  noResultsLabel={t("common.noResults")}
                                  onPaste={(e) => handlePaste(e, index, 4)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="border-e border-border p-1 text-end text-sm font-medium tabular-nums text-foreground">
                            {formatAmount(lineTotal.toString())}
                          </TableCell>
                          <TableCell className="p-1 text-center">
                            <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                              <Trash2 className="size-4 text-error" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append(emptyLine)}>
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
            <Button type="button" variant="outline" onClick={() => navigate("/purchasing/invoices")}>
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
