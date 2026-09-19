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
import { useConfirm } from "@/components/ui/confirm-provider";
import { bankingApi, type BankTransfer, type VoucherStatus } from "@/api/banking";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<VoucherStatus, "neutral" | "success"> = { DRAFT: "neutral", POSTED: "success" };

const schema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    transferDate: z.string().min(1),
    amount: z.string().min(1),
    description: z.string().optional(),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "sameAccount" });
type FormValues = z.infer<typeof schema>;

export function BankTransfersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["banking", "transfers"], queryFn: bankingApi.transfers.list });
  const cashBankAccountsQuery = useQuery({ queryKey: ["banking", "accounts"], queryFn: bankingApi.accounts.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { transferDate: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) => bankingApi.transfers.create({ ...v, description: v.description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "transfers"] });
      toast({ title: t("banking.transferCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ transferDate: new Date().toISOString().slice(0, 10) });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => bankingApi.transfers.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "transfers"] });
      toast({ title: t("banking.voucherPosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handlePost = async (transfer: BankTransfer) => {
    const ok = await confirm({
      title: t("banking.postConfirmTitle"),
      description: t("banking.postConfirmBody"),
      confirmLabel: t("banking.postVoucher"),
    });
    if (ok) postMutation.mutate(transfer.id);
  };

  const columns: ColumnDef<BankTransfer>[] = [
    { accessorKey: "transferNumber", header: t("banking.transferNumber") },
    { id: "date", header: t("banking.voucherDate"), cell: ({ row }) => formatDate(row.original.transferDate) },
    { id: "from", header: t("banking.fromAccount"), cell: ({ row }) => row.original.fromAccount.name },
    { id: "to", header: t("banking.toAccount"), cell: ({ row }) => row.original.toAccount.name },
    { id: "amount", header: t("banking.amount"), cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.amount)}</span> },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`banking.status_${row.original.status}`)}</Badge>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "DRAFT" &&
        hasPermission("banking.bank_transfer.post") && (
          <Button size="sm" variant="outline" onClick={() => handlePost(row.original)} loading={postMutation.isPending}>
            {t("banking.postVoucher")}
          </Button>
        ),
    },
  ];

  const toAccountError = form.formState.errors.toAccountId?.message === "sameAccount" ? t("banking.sameAccountError") : undefined;

  return (
    <div>
      <PageHeader
        title={t("banking.transfers")}
        description={t("banking.transfersDesc")}
        breadcrumbs={[{ label: t("nav.banking") }, { label: t("banking.transfers") }]}
        actions={
          hasPermission("banking.bank_transfer.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ transferDate: new Date().toISOString().slice(0, 10) });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("banking.newTransfer")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("banking.newTransfer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("banking.fromAccount")} htmlFor="bt-fromAccountId" error={form.formState.errors.fromAccountId?.message}>
                <Controller
                  control={form.control}
                  name="fromAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="bt-fromAccountId">
                        <SelectValue placeholder={t("banking.fromAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {cashBankAccountsQuery.data?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label={t("banking.toAccount")} htmlFor="bt-toAccountId" error={toAccountError}>
                <Controller
                  control={form.control}
                  name="toAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="bt-toAccountId">
                        <SelectValue placeholder={t("banking.toAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {cashBankAccountsQuery.data?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("banking.voucherDate")} htmlFor="bt-transferDate" error={form.formState.errors.transferDate?.message}>
                  <Input id="bt-transferDate" type="date" {...form.register("transferDate")} />
                </FormField>
                <FormField label={t("banking.amount")} htmlFor="bt-amount" error={form.formState.errors.amount?.message}>
                  <Input id="bt-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
                </FormField>
              </div>
              <FormField label={t("banking.description")} htmlFor="bt-description">
                <Input id="bt-description" {...form.register("description")} />
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
