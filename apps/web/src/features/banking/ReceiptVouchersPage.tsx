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
import { bankingApi, type ReceiptVoucher, type VoucherStatus } from "@/api/banking";
import { partiesApi } from "@/api/parties";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<VoucherStatus, "neutral" | "success"> = { DRAFT: "neutral", POSTED: "success" };

const schema = z
  .object({
    cashBankAccountId: z.string().min(1),
    voucherDate: z.string().min(1),
    partyType: z.enum(["CUSTOMER", "SUPPLIER", "OTHER"]),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    otherAccountId: z.string().optional(),
    amount: z.string().min(1),
    description: z.string().optional(),
  })
  .refine((v) => v.partyType !== "CUSTOMER" || !!v.customerId, { path: ["customerId"], message: "required" })
  .refine((v) => v.partyType !== "SUPPLIER" || !!v.supplierId, { path: ["supplierId"], message: "required" })
  .refine((v) => v.partyType !== "OTHER" || !!v.otherAccountId, { path: ["otherAccountId"], message: "required" });
type FormValues = z.infer<typeof schema>;

export function ReceiptVouchersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["banking", "receipt-vouchers"], queryFn: bankingApi.receiptVouchers.list });
  const cashBankAccountsQuery = useQuery({ queryKey: ["banking", "accounts"], queryFn: bankingApi.accounts.list });
  const customersQuery = useQuery({ queryKey: ["parties", "customers"], queryFn: partiesApi.customers.list });
  const suppliersQuery = useQuery({ queryKey: ["parties", "suppliers"], queryFn: partiesApi.suppliers.list });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { voucherDate: new Date().toISOString().slice(0, 10), partyType: "CUSTOMER" },
  });
  const watchedPartyType = form.watch("partyType");

  const createMutation = useMutation({
    mutationFn: (v: FormValues) =>
      bankingApi.receiptVouchers.create({
        cashBankAccountId: v.cashBankAccountId,
        voucherDate: v.voucherDate,
        partyType: v.partyType,
        customerId: v.partyType === "CUSTOMER" ? v.customerId : undefined,
        supplierId: v.partyType === "SUPPLIER" ? v.supplierId : undefined,
        otherAccountId: v.partyType === "OTHER" ? v.otherAccountId : undefined,
        amount: v.amount,
        description: v.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "receipt-vouchers"] });
      toast({ title: t("banking.receiptVoucherCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ voucherDate: new Date().toISOString().slice(0, 10), partyType: "CUSTOMER" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => bankingApi.receiptVouchers.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "receipt-vouchers"] });
      toast({ title: t("banking.voucherPosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handlePost = async (voucher: ReceiptVoucher) => {
    const ok = await confirm({
      title: t("banking.postConfirmTitle"),
      description: t("banking.postConfirmBody"),
      confirmLabel: t("banking.postVoucher"),
    });
    if (ok) postMutation.mutate(voucher.id);
  };

  const partyName = (v: ReceiptVoucher) => {
    if (v.partyType === "CUSTOMER") return v.customer?.name ?? "—";
    if (v.partyType === "SUPPLIER") return v.supplier?.name ?? "—";
    return v.otherAccount?.name ?? "—";
  };

  const columns: ColumnDef<ReceiptVoucher>[] = [
    { accessorKey: "voucherNumber", header: t("banking.voucherNumber") },
    { id: "date", header: t("banking.voucherDate"), cell: ({ row }) => formatDate(row.original.voucherDate) },
    { id: "account", header: t("banking.cashBankAccount"), cell: ({ row }) => row.original.cashBankAccount.name },
    { id: "party", header: t("banking.partyType"), cell: ({ row }) => `${t(`banking.partyType_${row.original.partyType}`)} — ${partyName(row.original)}` },
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
        hasPermission("banking.receipt_voucher.post") && (
          <Button size="sm" variant="outline" onClick={() => handlePost(row.original)} loading={postMutation.isPending}>
            {t("banking.postVoucher")}
          </Button>
        ),
    },
  ];

  const partyTypeError =
    form.formState.errors.customerId?.message || form.formState.errors.supplierId?.message || form.formState.errors.otherAccountId?.message;

  return (
    <div>
      <PageHeader
        title={t("banking.receiptVouchers")}
        description={t("banking.receiptVouchersDesc")}
        breadcrumbs={[{ label: t("nav.banking") }, { label: t("banking.receiptVouchers") }]}
        actions={
          hasPermission("banking.receipt_voucher.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ voucherDate: new Date().toISOString().slice(0, 10), partyType: "CUSTOMER" });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("banking.newReceiptVoucher")}
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
            <DialogTitle>{t("banking.newReceiptVoucher")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField
                label={t("banking.cashBankAccount")}
                htmlFor="rv-cashBankAccountId"
                error={form.formState.errors.cashBankAccountId?.message}
              >
                <Controller
                  control={form.control}
                  name="cashBankAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="rv-cashBankAccountId">
                        <SelectValue placeholder={t("banking.cashBankAccount")} />
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
                <FormField label={t("banking.voucherDate")} htmlFor="rv-voucherDate" error={form.formState.errors.voucherDate?.message}>
                  <Input id="rv-voucherDate" type="date" {...form.register("voucherDate")} />
                </FormField>
                <FormField label={t("banking.amount")} htmlFor="rv-amount" error={form.formState.errors.amount?.message}>
                  <Input id="rv-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
                </FormField>
              </div>

              <FormField label={t("banking.partyType")} htmlFor="rv-partyType">
                <Controller
                  control={form.control}
                  name="partyType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="rv-partyType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOMER">{t("banking.partyType_CUSTOMER")}</SelectItem>
                        <SelectItem value="SUPPLIER">{t("banking.partyType_SUPPLIER")}</SelectItem>
                        <SelectItem value="OTHER">{t("banking.partyType_OTHER")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              {watchedPartyType === "CUSTOMER" && (
                <FormField label={t("sales.customer")} htmlFor="rv-customerId" error={partyTypeError}>
                  <Controller
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="rv-customerId">
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
              )}
              {watchedPartyType === "SUPPLIER" && (
                <FormField label={t("purchasing.supplier")} htmlFor="rv-supplierId" error={partyTypeError}>
                  <Controller
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="rv-supplierId">
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
              )}
              {watchedPartyType === "OTHER" && (
                <FormField label={t("banking.otherAccount")} htmlFor="rv-otherAccountId" error={partyTypeError}>
                  <Controller
                    control={form.control}
                    name="otherAccountId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="rv-otherAccountId">
                          <SelectValue placeholder={t("banking.otherAccount")} />
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
              )}

              <FormField label={t("banking.description")} htmlFor="rv-description">
                <Input id="rv-description" {...form.register("description")} />
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
