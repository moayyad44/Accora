import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { hrApi, type PayrollRunStatus, type PayrollItemType } from "@/api/hr";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<PayrollRunStatus, "neutral" | "warning" | "success"> = {
  DRAFT: "neutral",
  APPROVED: "warning",
  POSTED: "success",
};

const ITEM_TYPES: PayrollItemType[] = ["BASIC", "ALLOWANCE", "DEDUCTION", "OVERTIME", "LOAN_REPAYMENT"];

const itemSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["BASIC", "ALLOWANCE", "DEDUCTION", "OVERTIME", "LOAN_REPAYMENT"]),
  amount: z.string().min(1),
  costCenterId: z.string().optional(),
  loanId: z.string().optional(),
  note: z.string().optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["hr", "payroll-runs", id],
    queryFn: () => hrApi.payrollRuns.get(id!),
    enabled: !!id,
  });
  const employeesQuery = useQuery({ queryKey: ["hr", "employees", "all"], queryFn: () => hrApi.employees.list() });
  const costCentersQuery = useQuery({ queryKey: ["accounting", "cost-centers"], queryFn: accountingApi.costCenters.list });

  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema), defaultValues: { type: "BASIC" } });
  const watchedEmployeeId = itemForm.watch("employeeId");
  const watchedType = itemForm.watch("type");

  const employeeLoansQuery = useQuery({
    queryKey: ["hr", "loans", watchedEmployeeId],
    queryFn: () => hrApi.loans.list(watchedEmployeeId),
    enabled: !!watchedEmployeeId && watchedType === "LOAN_REPAYMENT",
  });
  const repayableLoans = (employeeLoansQuery.data ?? []).filter((l) => new Decimal(l.remainingBalance).gt(0));

  const addItemMutation = useMutation({
    mutationFn: (v: ItemFormValues) =>
      hrApi.payrollRuns.addItem(id!, {
        employeeId: v.employeeId,
        type: v.type,
        amount: v.amount,
        costCenterId: v.costCenterId || undefined,
        loanId: v.type === "LOAN_REPAYMENT" ? v.loanId : undefined,
        note: v.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "payroll-runs", id] });
      toast({ title: t("hr.itemAdded"), variant: "success" });
      setItemDialogOpen(false);
      itemForm.reset({ type: "BASIC" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => hrApi.payrollRuns.removeItem(id!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "payroll-runs", id] });
      toast({ title: t("hr.itemRemoved"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const approveMutation = useMutation({
    mutationFn: () => hrApi.payrollRuns.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "payroll-runs", id] });
      toast({ title: t("hr.runApproved"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const postMutation = useMutation({
    mutationFn: () => hrApi.payrollRuns.post(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "payroll-runs", id] });
      toast({ title: t("hr.runPosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handleApprove = async () => {
    const ok = await confirm({
      title: t("hr.approveRunConfirmTitle"),
      description: t("hr.approveRunConfirmBody"),
      confirmLabel: t("hr.approveRun"),
    });
    if (ok) approveMutation.mutate();
  };

  const handlePost = async () => {
    const ok = await confirm({
      title: t("hr.postRunConfirmTitle"),
      description: t("hr.postRunConfirmBody"),
      confirmLabel: t("hr.postRun"),
      destructive: true,
    });
    if (ok) postMutation.mutate();
  };

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

  const run = query.data;
  const isDraft = run.status === "DRAFT";

  let totalGross = new Decimal(0);
  let totalDeductions = new Decimal(0);
  let totalLoanRepayments = new Decimal(0);
  for (const item of run.items) {
    const amount = new Decimal(item.amount);
    if (item.type === "DEDUCTION") totalDeductions = totalDeductions.plus(amount);
    else if (item.type === "LOAN_REPAYMENT") totalLoanRepayments = totalLoanRepayments.plus(amount);
    else totalGross = totalGross.plus(amount);
  }
  const netPayable = totalGross.minus(totalDeductions).minus(totalLoanRepayments);

  return (
    <div>
      <PageHeader
        title={run.period.name}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.payrollRuns"), to: "/hr/payroll-runs" }, { label: run.period.name }]}
        actions={
          <>
            {isDraft && hasPermission("hr.payroll_run.approve") && (
              <Button onClick={handleApprove} loading={approveMutation.isPending}>
                {t("hr.approveRun")}
              </Button>
            )}
            {run.status === "APPROVED" && hasPermission("hr.payroll_run.post") && (
              <Button onClick={handlePost} loading={postMutation.isPending}>
                {t("hr.postRun")}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[run.status]}>{t(`hr.payrollStatus_${run.status}`)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted">{t("hr.totalGross")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(totalGross.toString())}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("hr.totalDeductions")}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(totalDeductions.plus(totalLoanRepayments).toString())}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("hr.netPayable")}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{formatAmount(netPayable.toString())}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("hr.items")}</h3>
        {isDraft && hasPermission("hr.payroll_run.update") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setServerError(null);
              itemForm.reset({ type: "BASIC" });
              setItemDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("hr.addItem")}
          </Button>
        )}
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("hr.employee")}</TableHead>
              <TableHead>{t("hr.itemType")}</TableHead>
              <TableHead className="text-end">{t("hr.amount")}</TableHead>
              <TableHead>{t("hr.costCenter")}</TableHead>
              <TableHead>{t("hr.note")}</TableHead>
              {isDraft && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.employee.fullName}</TableCell>
                <TableCell>{t(`hr.itemType_${item.type}`)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatAmount(item.amount)}</TableCell>
                <TableCell className="text-muted">{item.costCenter?.name ?? "—"}</TableCell>
                <TableCell className="text-muted">{item.note ?? "—"}</TableCell>
                {isDraft && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItemMutation.mutate(item.id)}
                      disabled={removeItemMutation.isPending}
                    >
                      <Trash2 className="size-4 text-error" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("hr.addItem")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={itemForm.handleSubmit((v) => addItemMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("hr.employee")} htmlFor="pi-employeeId" error={itemForm.formState.errors.employeeId?.message}>
                <Controller
                  control={itemForm.control}
                  name="employeeId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="pi-employeeId">
                        <SelectValue placeholder={t("hr.employee")} />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesQuery.data?.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.employeeNumber} — {e.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.itemType")} htmlFor="pi-type">
                  <Controller
                    control={itemForm.control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="pi-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((it) => (
                            <SelectItem key={it} value={it}>
                              {t(`hr.itemType_${it}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label={t("hr.amount")} htmlFor="pi-amount" error={itemForm.formState.errors.amount?.message}>
                  <Input id="pi-amount" inputMode="decimal" placeholder="0.00" {...itemForm.register("amount")} />
                </FormField>
              </div>

              {watchedType === "LOAN_REPAYMENT" ? (
                <FormField label={t("hr.loan")} htmlFor="pi-loanId" error={itemForm.formState.errors.loanId?.message}>
                  <Controller
                    control={itemForm.control}
                    name="loanId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={!watchedEmployeeId}>
                        <SelectTrigger id="pi-loanId">
                          <SelectValue placeholder={t("hr.loan")} />
                        </SelectTrigger>
                        <SelectContent>
                          {repayableLoans.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {formatAmount(l.remainingBalance)} ({t("hr.remainingBalance")})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              ) : (
                <FormField label={t("hr.costCenter")} htmlFor="pi-costCenterId">
                  <Controller
                    control={itemForm.control}
                    name="costCenterId"
                    render={({ field }) => (
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                        <SelectTrigger id="pi-costCenterId">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {costCentersQuery.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              )}

              <FormField label={t("hr.note")} htmlFor="pi-note">
                <Input id="pi-note" {...itemForm.register("note")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={addItemMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
