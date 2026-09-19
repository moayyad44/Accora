import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { taxApi } from "@/api/tax";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  name: z.string().min(1),
  rate: z.string().min(1),
  payableAccountId: z.string().min(1),
  effectiveDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function TaxTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["tax", "types", id],
    queryFn: () => taxApi.types.get(id!),
    enabled: !!id,
  });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { effectiveDate: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) => taxApi.rates.create({ ...v, taxTypeId: id! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax", "types", id] });
      toast({ title: t("tax.rateCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ effectiveDate: new Date().toISOString().slice(0, 10) });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="error" title={t("common.errorTitle")}>
        {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
      </Alert>
    );
  }

  const taxType = query.data;

  return (
    <div>
      <PageHeader
        title={taxType.name}
        breadcrumbs={[{ label: t("nav.taxes") }, { label: t("tax.taxTypes"), to: "/tax/types" }, { label: taxType.name }]}
        actions={
          hasPermission("tax.tax_type.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ effectiveDate: new Date().toISOString().slice(0, 10) });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("tax.addRate")}
            </Button>
          )
        }
      />

      {taxType.rates.length === 0 ? (
        <EmptyState title={t("tax.noRates")} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tax.rateName")}</TableHead>
                <TableHead className="text-end">{t("tax.ratePercent")}</TableHead>
                <TableHead>{t("tax.effectiveDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxType.rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(r.rate, 3)}%</TableCell>
                  <TableCell>{formatDate(r.effectiveDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("tax.addRate")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("tax.rateName")} htmlFor="tr-name" error={form.formState.errors.name?.message} hint="مثال: 16%">
                <Input id="tr-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("tax.ratePercent")} htmlFor="tr-rate" error={form.formState.errors.rate?.message}>
                <Input id="tr-rate" inputMode="decimal" placeholder="0.000" {...form.register("rate")} />
              </FormField>
              <FormField
                label={t("tax.payableAccount")}
                htmlFor="tr-payableAccountId"
                error={form.formState.errors.payableAccountId?.message}
              >
                <Controller
                  control={form.control}
                  name="payableAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="tr-payableAccountId">
                        <SelectValue placeholder={t("tax.payableAccount")} />
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
              </FormField>
              <FormField label={t("tax.effectiveDate")} htmlFor="tr-effectiveDate" error={form.formState.errors.effectiveDate?.message}>
                <Input id="tr-effectiveDate" type="date" {...form.register("effectiveDate")} />
              </FormField>
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
