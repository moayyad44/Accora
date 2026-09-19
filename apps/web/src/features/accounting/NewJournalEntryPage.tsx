import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const lineSchema = z.object({
  accountId: z.string().min(1, "مطلوب"),
  costCenterId: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  description: z.string().optional(),
});

const schema = z.object({
  entryDate: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(lineSchema).min(2),
});
type FormValues = z.infer<typeof schema>;

function toDecimal(value: string | undefined): Decimal {
  if (!value || value.trim() === "") return new Decimal(0);
  const d = new Decimal(value.replace(/,/g, ""));
  return d.isNaN() ? new Decimal(0) : d;
}

export function NewJournalEntryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const costCentersQuery = useQuery({ queryKey: ["accounting", "cost-centers"], queryFn: accountingApi.costCenters.list });

  const postableAccounts = (accountsQuery.data ?? [])
    .filter((a) => !a.isHeader && a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      lines: [
        { accountId: "", debit: "", credit: "", description: "" },
        { accountId: "", debit: "", credit: "", description: "" },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watchedLines = form.watch("lines");

  const totalDebit = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.debit)), new Decimal(0));
  const totalCredit = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.credit)), new Decimal(0));
  const isBalanced = totalDebit.gt(0) && totalDebit.eq(totalCredit);

  const createMutation = useMutation({
    mutationFn: accountingApi.journalEntries.create,
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal-entries"] });
      toast({ title: t("accounting.entryCreated"), variant: "success" });
      navigate(`/accounting/journal-entries/${entry.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    if (!isBalanced) return;
    createMutation.mutate({
      entryDate: values.entryDate,
      description: values.description || undefined,
      lines: values.lines
        .filter((l) => l.accountId && (toDecimal(l.debit).gt(0) || toDecimal(l.credit).gt(0)))
        .map((l) => ({
          accountId: l.accountId,
          costCenterId: l.costCenterId || undefined,
          debit: toDecimal(l.debit).gt(0) ? toDecimal(l.debit).toFixed(4) : undefined,
          credit: toDecimal(l.credit).gt(0) ? toDecimal(l.credit).toFixed(4) : undefined,
          description: l.description || undefined,
        })),
    });
  };

  return (
    <div>
      <PageHeader
        title={t("accounting.newEntry")}
        breadcrumbs={[
          { label: t("nav.accounting") },
          { label: t("accounting.journalEntries"), to: "/accounting/journal-entries" },
          { label: t("accounting.newEntry") },
        ]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("accounting.entryDate")} htmlFor="entryDate" error={form.formState.errors.entryDate?.message}>
                <Input id="entryDate" type="date" {...form.register("entryDate")} />
              </FormField>
              <FormField label={t("accounting.description")} htmlFor="description">
                <Input id="description" {...form.register("description")} />
              </FormField>
            </div>

            <div className="mt-2">
              <Label>{t("accounting.lines")}</Label>
              <div className="mt-2 flex flex-col gap-2">
                <div className="hidden gap-2 px-1 text-xs font-semibold uppercase text-muted sm:grid sm:grid-cols-[1fr_1fr_120px_120px_36px]">
                  <span>{t("accounting.account")}</span>
                  <span>{t("accounting.costCenter")}</span>
                  <span>{t("accounting.debit")}</span>
                  <span>{t("accounting.credit")}</span>
                  <span />
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    data-testid={`journal-line-${index}`}
                    className="grid grid-cols-1 items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_120px_120px_36px] sm:border-0 sm:p-0"
                  >
                    <Controller
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className={cn(form.formState.errors.lines?.[index]?.accountId && "border-error")}>
                            <SelectValue placeholder={t("accounting.account")} />
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
                    <Controller
                      control={form.control}
                      name={`lines.${index}.costCenterId`}
                      render={({ field: f }) => (
                        <Select value={f.value ?? "none"} onValueChange={(v) => f.onChange(v === "none" ? undefined : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("accounting.costCenter")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {costCentersQuery.data?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.code} — {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      className="text-end tabular-nums"
                      {...form.register(`lines.${index}.debit`)}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      className="text-end tabular-nums"
                      {...form.register(`lines.${index}.credit`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length <= 2}
                      onClick={() => remove(index)}
                    >
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
                onClick={() => append({ accountId: "", debit: "", credit: "", description: "" })}
              >
                <Plus className="size-4" />
                {t("accounting.addLine")}
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-end gap-6 border-t border-border pt-3 text-sm">
              <span className="text-muted">
                {t("accounting.totalDebit")}: <span className="font-semibold tabular-nums text-foreground">{formatAmount(totalDebit.toString())}</span>
              </span>
              <span className="text-muted">
                {t("accounting.totalCredit")}: <span className="font-semibold tabular-nums text-foreground">{formatAmount(totalCredit.toString())}</span>
              </span>
            </div>

            {!isBalanced && (totalDebit.gt(0) || totalCredit.gt(0)) && (
              <Alert variant="warning">{t("accounting.unbalancedWarning")}</Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/accounting/journal-entries")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!isBalanced} loading={createMutation.isPending}>
              {t("accounting.createEntry")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
