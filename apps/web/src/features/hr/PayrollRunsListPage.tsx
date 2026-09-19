import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";

import { useToast } from "@/components/ui/toast";
import { hrApi, type PayrollRun, type PayrollRunStatus } from "@/api/hr";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<PayrollRunStatus, "neutral" | "warning" | "success"> = {
  DRAFT: "neutral",
  APPROVED: "warning",
  POSTED: "success",
};

export function PayrollRunsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [periodId, setPeriodId] = React.useState("");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["hr", "payroll-runs"], queryFn: () => hrApi.payrollRuns.list() });
  const fiscalYearsQuery = useQuery({ queryKey: ["accounting", "fiscal-years"], queryFn: accountingApi.fiscalYears.list });
  const periods = (fiscalYearsQuery.data ?? []).flatMap((fy) => fy.periods.map((p) => ({ ...p, fiscalYearName: fy.name })));

  const createMutation = useMutation({
    mutationFn: () => hrApi.payrollRuns.createDraft(periodId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "payroll-runs"] });
      toast({ title: t("hr.payrollRunCreated"), variant: "success" });
      setDialogOpen(false);
      navigate(`/hr/payroll-runs/${run.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<PayrollRun>[] = [
    { id: "period", header: t("fixedAssets.period"), cell: ({ row }) => row.original.period.name },
    { id: "runDate", header: t("hr.runDate"), cell: ({ row }) => formatDate(row.original.runDate) },
    { id: "items", header: t("hr.items"), cell: ({ row }) => row.original.items.length },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`hr.payrollStatus_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("hr.payrollRuns")}
        description={t("hr.payrollRunsDesc")}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.payrollRuns") }]}
        actions={
          hasPermission("hr.payroll_run.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                setPeriodId("");
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("hr.newPayrollRun")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isPending}
          onRowClick={(row) => navigate(`/hr/payroll-runs/${row.id}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("hr.newPayrollRun")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger>
                <SelectValue placeholder={t("fixedAssets.selectPeriod")} />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fiscalYearName} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!periodId}>
              {t("hr.newPayrollRun")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
