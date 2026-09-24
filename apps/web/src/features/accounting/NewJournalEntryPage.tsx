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
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { createGridPasteHandler, resolveOptionId, type GridOption } from "@/lib/gridPaste";
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

const emptyLine = { accountId: "", debit: "", credit: "", description: "" };

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

  const accountOptions: GridOption[] = postableAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, code: a.code }));
  const costCenterOptions: GridOption[] = [
    { value: "", label: "—" },
    ...(costCentersQuery.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.name}`, code: c.code })),
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      lines: [emptyLine, emptyLine],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watchedLines = form.watch("lines");

  const totalDebit = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.debit)), new Decimal(0));
  const totalCredit = watchedLines.reduce((sum, l) => sum.plus(toDecimal(l.credit)), new Decimal(0));
  const isBalanced = totalDebit.gt(0) && totalDebit.eq(totalCredit);

  const handlePaste = createGridPasteHandler({
    linesPath: "lines",
    currentRowCount: fields.length,
    appendRow: () => append(emptyLine),
    setValue: (path, value) => form.setValue(path as never, value as never),
    columns: [
      { key: "accountId", resolve: (text) => resolveOptionId(accountOptions, text) ?? "" },
      { key: "costCenterId", resolve: (text) => resolveOptionId(costCenterOptions, text) ?? "" },
      { key: "debit", resolve: (text) => text.trim() },
      { key: "credit", resolve: (text) => text.trim() },
    ],
  });

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
              <p className="mb-2 mt-1 text-xs text-muted">{t("common.pasteHint")}</p>

              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px] border-e border-border">{t("accounting.account")}</TableHead>
                      <TableHead className="min-w-[180px] border-e border-border">{t("accounting.costCenter")}</TableHead>
                      <TableHead className="w-32 border-e border-border">{t("accounting.debit")}</TableHead>
                      <TableHead className="w-32 border-e border-border">{t("accounting.credit")}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id} data-testid={`journal-line-${index}`}>
                        <TableCell className="border-e border-border p-1">
                          <Controller
                            control={form.control}
                            name={`lines.${index}.accountId`}
                            render={({ field: f }) => (
                              <Combobox
                                value={f.value}
                                onValueChange={(v) => f.onChange(v ?? "")}
                                options={accountOptions}
                                placeholder={t("accounting.account")}
                                noResultsLabel={t("common.noResults")}
                                invalid={!!form.formState.errors.lines?.[index]?.accountId}
                                onPaste={(e) => handlePaste(e, index, 0)}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="border-e border-border p-1">
                          <Controller
                            control={form.control}
                            name={`lines.${index}.costCenterId`}
                            render={({ field: f }) => (
                              <Combobox
                                value={f.value ?? ""}
                                onValueChange={(v) => f.onChange(v ?? "")}
                                options={costCenterOptions}
                                placeholder={t("accounting.costCenter")}
                                noResultsLabel={t("common.noResults")}
                                onPaste={(e) => handlePaste(e, index, 1)}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="border-e border-border p-1">
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            className={cn("h-9 border-0 bg-transparent text-end tabular-nums focus-visible:ring-1")}
                            {...form.register(`lines.${index}.debit`)}
                            onPaste={(e) => handlePaste(e, index, 2)}
                          />
                        </TableCell>
                        <TableCell className="border-e border-border p-1">
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            className={cn("h-9 border-0 bg-transparent text-end tabular-nums focus-visible:ring-1")}
                            {...form.register(`lines.${index}.credit`)}
                            onPaste={(e) => handlePaste(e, index, 3)}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={fields.length <= 2}
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4 text-error" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append(emptyLine)}>
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
