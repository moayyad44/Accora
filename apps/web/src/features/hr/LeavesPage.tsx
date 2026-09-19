import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Check, X } from "lucide-react";
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
import { hrApi, type Leave, type LeaveStatus } from "@/api/hr";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<LeaveStatus, "neutral" | "success" | "error"> = {
  PENDING: "neutral",
  APPROVED: "success",
  REJECTED: "error",
};

const schema = z.object({
  employeeId: z.string().min(1),
  type: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function LeavesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["hr", "leaves"], queryFn: () => hrApi.leaves.list() });
  const employeesQuery = useQuery({ queryKey: ["hr", "employees", "all"], queryFn: () => hrApi.employees.list() });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const requestMutation = useMutation({
    mutationFn: hrApi.leaves.request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "leaves"] });
      toast({ title: t("hr.leaveRequested"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ leaveId, status }: { leaveId: string; status: "APPROVED" | "REJECTED" }) =>
      hrApi.leaves.setStatus(leaveId, status),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "leaves"] });
      toast({ title: t(vars.status === "APPROVED" ? "hr.leaveApproved" : "hr.leaveRejected"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handleDecision = async (leave: Leave, status: "APPROVED" | "REJECTED") => {
    const ok = await confirm({
      title: t(status === "APPROVED" ? "hr.approveConfirmTitle" : "hr.rejectConfirmTitle"),
      confirmLabel: t(status === "APPROVED" ? "hr.approve" : "hr.reject"),
      destructive: status === "REJECTED",
    });
    if (ok) statusMutation.mutate({ leaveId: leave.id, status });
  };

  const canApprove = hasPermission("hr.leave.approve");

  const columns: ColumnDef<Leave>[] = [
    { id: "employee", header: t("hr.employee"), cell: ({ row }) => row.original.employee.fullName },
    { accessorKey: "type", header: t("hr.leaveType") },
    { id: "startDate", header: t("accounting.startDate"), cell: ({ row }) => formatDate(row.original.startDate) },
    { id: "endDate", header: t("accounting.endDate"), cell: ({ row }) => formatDate(row.original.endDate) },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`hr.leaveStatus_${row.original.status}`)}</Badge>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "PENDING" &&
        canApprove && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => handleDecision(row.original, "APPROVED")}>
              <Check className="size-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => handleDecision(row.original, "REJECTED")}>
              <X className="size-4 text-error" />
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("hr.leaves")}
        description={t("hr.leavesDesc")}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.leaves") }]}
        actions={
          hasPermission("hr.leave.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("hr.requestLeave")}
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
            <DialogTitle>{t("hr.requestLeave")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => requestMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("hr.employee")} htmlFor="lv-employeeId" error={form.formState.errors.employeeId?.message}>
                <Controller
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="lv-employeeId">
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
              <FormField label={t("hr.leaveType")} htmlFor="lv-type" error={form.formState.errors.type?.message} hint="مثال: سنوية، مرضية، طارئة">
                <Input id="lv-type" {...form.register("type")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.startDate")} htmlFor="lv-startDate" error={form.formState.errors.startDate?.message}>
                  <Input id="lv-startDate" type="date" {...form.register("startDate")} />
                </FormField>
                <FormField label={t("accounting.endDate")} htmlFor="lv-endDate" error={form.formState.errors.endDate?.message}>
                  <Input id="lv-endDate" type="date" {...form.register("endDate")} />
                </FormField>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={requestMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
