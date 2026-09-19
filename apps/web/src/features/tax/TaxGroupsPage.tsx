import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { taxApi, type TaxGroup } from "@/api/tax";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  taxRateIds: z.array(z.string()).min(1, "select_rates"),
});
type FormValues = z.infer<typeof schema>;

export function TaxGroupsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["tax", "groups"], queryFn: taxApi.groups.list });
  const typesQuery = useQuery({ queryKey: ["tax", "types"], queryFn: taxApi.types.list });
  const typesWithRates = (typesQuery.data ?? []).filter((tt) => tt.rates.length > 0);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { taxRateIds: [] } });

  const createMutation = useMutation({
    mutationFn: taxApi.groups.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax", "groups"] });
      toast({ title: t("tax.taxGroupCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ taxRateIds: [] });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<TaxGroup>[] = [
    { accessorKey: "name", header: t("accounting.name") },
    {
      id: "rates",
      header: t("tax.includedRates"),
      cell: ({ row }) => row.original.rates.map((r) => `${r.taxRate.taxType.name} (${formatAmount(r.taxRate.rate, 3)}%)`).join("، "),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("tax.taxGroups")}
        description={t("tax.taxGroupsDesc")}
        breadcrumbs={[{ label: t("nav.taxes") }, { label: t("tax.taxGroups") }]}
        actions={
          hasPermission("tax.tax_group.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ taxRateIds: [] });
                setDialogOpen(true);
              }}
              disabled={typesWithRates.length === 0}
            >
              <Plus className="size-4" />
              {t("tax.addTaxGroup")}
            </Button>
          )
        }
      />

      {!typesQuery.isPending && typesWithRates.length === 0 && (
        <Alert variant="warning" className="mb-4">
          {t("tax.onlyTaxTypesFirst")}
        </Alert>
      )}

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (query.data?.length ?? 0) === 0 && !query.isPending ? (
        <EmptyState title={t("common.noData")} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("tax.addTaxGroup")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.nameEn")} htmlFor="tg-name" error={form.formState.errors.name?.message}>
                  <Input id="tg-name" {...form.register("name")} />
                </FormField>
                <FormField label={t("accounting.nameAr")} htmlFor="tg-nameAr">
                  <Input id="tg-nameAr" dir="rtl" {...form.register("nameAr")} />
                </FormField>
              </div>

              <div>
                <Label>{t("tax.includedRates")}</Label>
                {form.formState.errors.taxRateIds && (
                  <p className="mt-1 text-xs text-error">{t("tax.selectRates")}</p>
                )}
                <Controller
                  control={form.control}
                  name="taxRateIds"
                  render={({ field }) => (
                    <div className="mt-2 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border border-border p-3">
                      {typesWithRates.map((tt) => (
                        <div key={tt.id}>
                          <p className="mb-1 text-xs font-semibold text-muted">{tt.name}</p>
                          <div className="flex flex-col gap-1.5">
                            {tt.rates.map((r) => (
                              <label key={r.id} className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={field.value.includes(r.id)}
                                  onCheckedChange={(checked) =>
                                    field.onChange(
                                      checked ? [...field.value, r.id] : field.value.filter((id: string) => id !== r.id),
                                    )
                                  }
                                />
                                {r.name} — {formatAmount(r.rate, 3)}%
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
