import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { bankingApi } from "@/api/banking";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  statementDate: z.string().min(1),
  statementBalance: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function ReconciliationPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ receipts: Set<string>; payments: Set<string>; transfers: Set<string> }>({
    receipts: new Set(),
    payments: new Set(),
    transfers: new Set(),
  });

  const today = new Date().toISOString().slice(0, 10);

  const accountsQuery = useQuery({ queryKey: ["banking", "accounts"], queryFn: bankingApi.accounts.list });
  const historyQuery = useQuery({
    queryKey: ["banking", "reconciliations", accountId],
    queryFn: () => bankingApi.reconciliations.list(accountId),
    enabled: !!accountId,
  });
  const balanceQuery = useQuery({
    queryKey: ["banking", "accounts", accountId, "balance"],
    queryFn: () => bankingApi.accounts.balance(accountId),
    enabled: !!accountId,
  });
  const unreconciledQuery = useQuery({
    queryKey: ["banking", "unreconciled", accountId, today],
    queryFn: () => bankingApi.reconciliations.unreconciled(accountId, today),
    enabled: !!accountId,
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { statementDate: today } });

  const runMutation = useMutation({
    mutationFn: (v: FormValues) => bankingApi.reconciliations.run({ cashBankAccountId: accountId, ...v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations", accountId] });
      toast({ title: t("banking.reconciliationRun"), variant: "success" });
      setDialogOpen(false);
      form.reset({ statementDate: today });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const markReconciledMutation = useMutation({
    mutationFn: () =>
      bankingApi.reconciliations.markReconciled({
        receiptVoucherIds: Array.from(selected.receipts),
        paymentVoucherIds: Array.from(selected.payments),
        bankTransferIds: Array.from(selected.transfers),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "unreconciled", accountId] });
      toast({ title: t("banking.markReconciledSuccess"), variant: "success" });
      setSelected({ receipts: new Set(), payments: new Set(), transfers: new Set() });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const toggle = (group: "receipts" | "payments" | "transfers", id: string) => {
    setSelected((prev) => {
      const next = new Set(prev[group]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [group]: next };
    });
  };

  const totalSelected = selected.receipts.size + selected.payments.size + selected.transfers.size;
  const unreconciled = unreconciledQuery.data;
  const hasUnreconciled =
    unreconciled &&
    (unreconciled.receipts.length > 0 ||
      unreconciled.payments.length > 0 ||
      unreconciled.transfersOut.length > 0 ||
      unreconciled.transfersIn.length > 0);

  if (accountsQuery.isPending) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        title={t("banking.reconciliation")}
        description={t("banking.reconciliationDesc")}
        breadcrumbs={[{ label: t("nav.banking") }, { label: t("banking.reconciliation") }]}
        actions={
          accountId &&
          hasPermission("banking.bank_reconciliation.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ statementDate: today });
                setDialogOpen(true);
              }}
            >
              {t("banking.runReconciliation")}
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-sm">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder={t("banking.selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {accountsQuery.data?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!accountId ? (
        <EmptyState title={t("banking.selectAccountFirst")} />
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">{t("banking.currentBalance")}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {balanceQuery.data ? formatAmount(balanceQuery.data.balance) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t("banking.history")}</h3>
            {(historyQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted">{t("common.noData")}</p>
            ) : (
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("banking.statementDate")}</TableHead>
                      <TableHead className="text-end">{t("banking.statementBalance")}</TableHead>
                      <TableHead className="text-end">{t("banking.bookBalance")}</TableHead>
                      <TableHead className="text-end">{t("banking.difference")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.statementDate)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(r.statementBalance)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(r.bookBalance)}</TableCell>
                        <TableCell
                          className={`text-end font-medium tabular-nums ${
                            new Decimal(r.difference).isZero() ? "text-muted" : "text-error"
                          }`}
                        >
                          {formatAmount(r.difference)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("banking.unreconciledItems")}</h3>
              {totalSelected > 0 && hasPermission("banking.bank_reconciliation.update") && (
                <Button size="sm" onClick={() => markReconciledMutation.mutate()} loading={markReconciledMutation.isPending}>
                  {t("banking.markReconciled")} ({totalSelected})
                </Button>
              )}
            </div>

            {!hasUnreconciled ? (
              <p className="text-sm text-muted">{t("banking.noUnreconciledItems")}</p>
            ) : (
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>{t("banking.voucherNumber")}</TableHead>
                      <TableHead>{t("banking.voucherDate")}</TableHead>
                      <TableHead>{t("banking.entryType")}</TableHead>
                      <TableHead className="text-end">{t("banking.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unreconciled?.receipts.map((r) => (
                      <TableRow key={`r-${r.id}`}>
                        <TableCell>
                          <Checkbox checked={selected.receipts.has(r.id)} onCheckedChange={() => toggle("receipts", r.id)} />
                        </TableCell>
                        <TableCell>{r.voucherNumber}</TableCell>
                        <TableCell>{formatDate(r.voucherDate)}</TableCell>
                        <TableCell>{t("banking.receiptVouchers")}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {unreconciled?.payments.map((p) => (
                      <TableRow key={`p-${p.id}`}>
                        <TableCell>
                          <Checkbox checked={selected.payments.has(p.id)} onCheckedChange={() => toggle("payments", p.id)} />
                        </TableCell>
                        <TableCell>{p.voucherNumber}</TableCell>
                        <TableCell>{formatDate(p.voucherDate)}</TableCell>
                        <TableCell>{t("banking.paymentVouchers")}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {[...(unreconciled?.transfersOut ?? []), ...(unreconciled?.transfersIn ?? [])].map((tr) => (
                      <TableRow key={`t-${tr.id}`}>
                        <TableCell>
                          <Checkbox checked={selected.transfers.has(tr.id)} onCheckedChange={() => toggle("transfers", tr.id)} />
                        </TableCell>
                        <TableCell>{tr.transferNumber}</TableCell>
                        <TableCell>{formatDate(tr.transferDate)}</TableCell>
                        <TableCell>{t("banking.transfers")}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(tr.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("banking.runReconciliation")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => runMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <p className="text-sm text-muted">{t("banking.runConfirmBody")}</p>
              <FormField label={t("banking.statementDate")} htmlFor="rec-statementDate" error={form.formState.errors.statementDate?.message}>
                <Input id="rec-statementDate" type="date" {...form.register("statementDate")} />
              </FormField>
              <FormField
                label={t("banking.statementBalance")}
                htmlFor="rec-statementBalance"
                error={form.formState.errors.statementBalance?.message}
              >
                <Input id="rec-statementBalance" inputMode="decimal" placeholder="0.00" {...form.register("statementBalance")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={runMutation.isPending}>
                {t("banking.runReconciliation")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
