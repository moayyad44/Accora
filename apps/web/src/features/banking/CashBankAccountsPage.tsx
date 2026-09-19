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
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { bankingApi, type CashBankAccount } from "@/api/banking";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  type: z.enum(["CASH", "BANK"]),
  accountId: z.string().min(1),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CashBankAccountsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["banking", "accounts"], queryFn: bankingApi.accounts.list });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: "CASH" } });
  const watchedType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: bankingApi.accounts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "accounts"] });
      toast({ title: t("banking.accountCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ type: "CASH" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<CashBankAccount>[] = [
    { accessorKey: "name", header: t("accounting.name") },
    {
      id: "type",
      header: t("banking.accountType"),
      cell: ({ row }) => <Badge variant={row.original.type === "CASH" ? "neutral" : "info"}>{t(`banking.type_${row.original.type}`)}</Badge>,
    },
    { id: "glAccount", header: t("banking.glAccount"), cell: ({ row }) => `${row.original.account.code} — ${row.original.account.name}` },
    { id: "bankName", header: t("banking.bankName"), cell: ({ row }) => row.original.bankName ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title={t("banking.accounts")}
        description={t("banking.accountsDesc")}
        breadcrumbs={[{ label: t("nav.banking") }, { label: t("banking.accounts") }]}
        actions={
          hasPermission("banking.cash_bank_account.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ type: "CASH" });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("banking.addAccount")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("banking.addAccount")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.nameEn")} htmlFor="cba-name" error={form.formState.errors.name?.message}>
                  <Input id="cba-name" {...form.register("name")} />
                </FormField>
                <FormField label={t("accounting.nameAr")} htmlFor="cba-nameAr">
                  <Input id="cba-nameAr" dir="rtl" {...form.register("nameAr")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("banking.accountType")} htmlFor="cba-type">
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="cba-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">{t("banking.type_CASH")}</SelectItem>
                          <SelectItem value="BANK">{t("banking.type_BANK")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label={t("banking.glAccount")} htmlFor="cba-accountId" error={form.formState.errors.accountId?.message}>
                  <Controller
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="cba-accountId">
                          <SelectValue placeholder={t("banking.glAccount")} />
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
              </div>
              {watchedType === "BANK" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label={t("banking.bankName")} htmlFor="cba-bankName">
                    <Input id="cba-bankName" {...form.register("bankName")} />
                  </FormField>
                  <FormField label={t("banking.accountNumber")} htmlFor="cba-accountNumber">
                    <Input id="cba-accountNumber" {...form.register("accountNumber")} />
                  </FormField>
                  <FormField label={t("banking.iban")} htmlFor="cba-iban">
                    <Input id="cba-iban" {...form.register("iban")} />
                  </FormField>
                </div>
              )}
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
