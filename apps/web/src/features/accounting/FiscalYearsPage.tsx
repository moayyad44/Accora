import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Lock, LockOpen, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { accountingApi, type FiscalPeriodStatus } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z
  .object({
    name: z.string().min(2),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
  })
  .refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate", path: ["endDate"] });
type FormValues = z.infer<typeof schema>;

export function FiscalYearsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["accounting", "fiscal-years"], queryFn: accountingApi.fiscalYears.list });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: accountingApi.fiscalYears.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "fiscal-years"] });
      toast({ title: t("accounting.fiscalYearCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const periodStatusMutation = useMutation({
    mutationFn: ({ periodId, status }: { periodId: string; status: FiscalPeriodStatus }) =>
      accountingApi.fiscalYears.setPeriodStatus(periodId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting", "fiscal-years"] }),
    onError: () => toast({ title: t("common.errorTitle"), description: t("common.errorGeneric"), variant: "error" }),
  });

  const canClose = hasPermission("core.fiscal_period.close");

  const handleTogglePeriod = async (periodId: string, current: FiscalPeriodStatus) => {
    if (current === "OPEN") {
      const ok = await confirm({
        title: t("accounting.closePeriodConfirmTitle"),
        description: t("accounting.closePeriodConfirmBody"),
        confirmLabel: t("accounting.closePeriod"),
      });
      if (!ok) return;
    }
    periodStatusMutation.mutate({ periodId, status: current === "OPEN" ? "CLOSED" : "OPEN" });
  };

  return (
    <div>
      <PageHeader
        title={t("accounting.fiscalYears")}
        description={t("accounting.fiscalYearsDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.fiscalYears") }]}
        actions={
          hasPermission("core.fiscal_period.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("accounting.addFiscalYear")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : query.data && query.data.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t("common.noData")} description={t("accounting.noOpenPeriodBody")} />
      ) : (
        <div className="flex flex-col gap-4">
          {query.data?.map((fy) => (
            <Card key={fy.id}>
              <CardHeader>
                <CardTitle>
                  {fy.name}
                  <span className="ms-2 font-normal text-subtle">
                    {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {fy.periods.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span className="text-foreground">{p.name}</span>
                    <Badge variant={p.status === "OPEN" ? "success" : "neutral"}>
                      {t(`accounting.periodStatus_${p.status}`)}
                    </Badge>
                    {canClose && (
                      <button
                        type="button"
                        className="text-subtle hover:text-foreground"
                        onClick={() => handleTogglePeriod(p.id, p.status)}
                        title={p.status === "OPEN" ? t("accounting.closePeriod") : t("accounting.reopenPeriod")}
                      >
                        {p.status === "OPEN" ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("accounting.addFiscalYear")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("accounting.name")} htmlFor="fy-name" error={form.formState.errors.name?.message}>
                <Input id="fy-name" placeholder="2026" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.startDate")} htmlFor="fy-start" error={form.formState.errors.startDate?.message}>
                <Input id="fy-start" type="date" {...form.register("startDate")} />
              </FormField>
              <FormField label={t("accounting.endDate")} htmlFor="fy-end" error={form.formState.errors.endDate?.message}>
                <Input id="fy-end" type="date" {...form.register("endDate")} />
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
