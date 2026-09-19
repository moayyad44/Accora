import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { manufacturingApi } from "@/api/manufacturing";
import { catalogApi } from "@/api/catalog";
import { ApiError } from "@/api/client";

const lineSchema = z.object({
  componentItemId: z.string().min(1),
  qty: z.string().min(1),
  unitId: z.string().min(1),
  scrapPercent: z.string().optional(),
});

const schema = z.object({
  itemId: z.string().min(1),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

export function NewBomPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const unitsQuery = useQuery({ queryKey: ["catalog", "units"], queryFn: catalogApi.units.list });

  const manufacturedItems = (itemsQuery.data ?? []).filter(
    (i) => i.itemType === "SEMI_FINISHED" || i.itemType === "FINISHED_GOOD",
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lines: [{ componentItemId: "", qty: "1", unitId: "", scrapPercent: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const createMutation = useMutation({
    mutationFn: manufacturingApi.boms.create,
    onSuccess: (bom) => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "boms"] });
      toast({ title: t("manufacturing.bomCreated"), variant: "success" });
      navigate(`/manufacturing/boms/${bom.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const isLoading = itemsQuery.isPending || unitsQuery.isPending;
  if (isLoading) return <Skeleton className="h-96" />;

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    createMutation.mutate({
      itemId: values.itemId,
      notes: values.notes || undefined,
      lines: values.lines.map((l) => ({
        componentItemId: l.componentItemId,
        qty: l.qty,
        unitId: l.unitId,
        scrapPercent: l.scrapPercent || undefined,
      })),
    });
  };

  return (
    <div>
      <PageHeader
        title={t("manufacturing.addBom")}
        breadcrumbs={[
          { label: t("nav.manufacturing") },
          { label: t("manufacturing.boms"), to: "/manufacturing/boms" },
          { label: t("manufacturing.addBom") },
        ]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            {manufacturedItems.length === 0 ? (
              <Alert variant="warning">{t("manufacturing.onlyManufacturedItems")}</Alert>
            ) : (
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
                <FormField label={t("manufacturing.notes")} htmlFor="notes">
                  <Input id="notes" {...form.register("notes")} />
                </FormField>
              </div>
            )}

            <div className="mt-2">
              <Label>{t("manufacturing.bomLines")}</Label>
              <div className="mt-2 flex flex-col gap-2">
                <div className="hidden gap-2 px-1 text-xs font-semibold uppercase text-muted sm:grid sm:grid-cols-[1fr_100px_120px_100px_36px]">
                  <span>{t("manufacturing.component")}</span>
                  <span>{t("manufacturing.componentQty")}</span>
                  <span>{t("catalog.unit")}</span>
                  <span>{t("manufacturing.scrapPercent")}</span>
                  <span />
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    data-testid={`bom-line-${index}`}
                    className="grid grid-cols-1 items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_100px_120px_100px_36px] sm:border-0 sm:p-0"
                  >
                    <Controller
                      control={form.control}
                      name={`lines.${index}.componentItemId`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("manufacturing.component")} />
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
                    <Input inputMode="decimal" className="text-end tabular-nums" {...form.register(`lines.${index}.qty`)} />
                    <Controller
                      control={form.control}
                      name={`lines.${index}.unitId`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("catalog.unit")} />
                          </SelectTrigger>
                          <SelectContent>
                            {unitsQuery.data?.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      className="text-end tabular-nums"
                      {...form.register(`lines.${index}.scrapPercent`)}
                    />
                    <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                      <Trash2 className="size-4 text-error" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ componentItemId: "", qty: "1", unitId: "", scrapPercent: "" })}
              >
                <Plus className="size-4" />
                {t("manufacturing.addLine")}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/manufacturing/boms")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={manufacturedItems.length === 0}>
              {t("manufacturing.addBom")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
