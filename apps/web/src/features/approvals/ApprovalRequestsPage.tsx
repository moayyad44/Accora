import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Check, X, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { approvalsApi, type ApprovalRequestListItem, type ApprovalRequestStatus } from "@/api/approvals";
import { ApiError } from "@/api/client";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<ApprovalRequestStatus, "neutral" | "success" | "error"> = {
  PENDING: "neutral",
  APPROVED: "success",
  REJECTED: "error",
};

const requestSchema = z.object({
  docType: z.string().min(1),
  docId: z.string().min(1),
  amount: z.string().min(1),
});
type RequestFormValues = z.infer<typeof requestSchema>;

export function ApprovalRequestsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [viewingId, setViewingId] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["approvals", "requests"], queryFn: () => approvalsApi.requests.list() });

  const form = useForm<RequestFormValues>({ resolver: zodResolver(requestSchema) });

  const createMutation = useMutation({
    mutationFn: (v: RequestFormValues) => approvalsApi.requests.create(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", "requests"] });
      toast({ title: t("approvals.requestCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ docType: "", docId: "", amount: "" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<ApprovalRequestListItem>[] = [
    { id: "workflow", header: t("approvals.workflows"), cell: ({ row }) => row.original.workflow.name },
    { accessorKey: "docType", header: t("approvals.docType"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.docType}</span> },
    { accessorKey: "docId", header: t("approvals.docId"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.docId.slice(0, 8)}</span> },
    {
      id: "step",
      header: t("approvals.currentStep"),
      cell: ({ row }) => (row.original.status === "PENDING" ? row.original.currentStep : "—"),
    },
    {
      id: "status",
      header: t("approvals.requestStatus"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`approvals.status_${row.original.status}`)}</Badge>,
    },
    { id: "createdAt", header: t("approvals.actedAt"), cell: ({ row }) => formatDateTime(row.original.createdAt) },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setViewingId(row.original.id)}>
          <Eye className="size-4" />
          {t("approvals.viewRequest")}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("approvals.requests")}
        description={t("approvals.requestsDesc")}
        breadcrumbs={[{ label: t("nav.approvals") }, { label: t("approvals.requests") }]}
        actions={
          hasPermission("core.approval_workflow.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ docType: "", docId: "", amount: "" });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("common.createNew")}
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
            <DialogTitle>{t("common.createNew")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("approvals.docType")} htmlFor="req-docType" error={form.formState.errors.docType?.message}>
                <Input id="req-docType" placeholder="PURCHASE_INVOICE" {...form.register("docType")} />
              </FormField>
              <FormField label={t("approvals.docId")} htmlFor="req-docId" error={form.formState.errors.docId?.message}>
                <Input id="req-docId" {...form.register("docId")} />
              </FormField>
              <FormField label={t("banking.amount")} htmlFor="req-amount" error={form.formState.errors.amount?.message}>
                <Input id="req-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
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

      <RequestDetailDialog id={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}

function RequestDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["approvals", "requests", id],
    queryFn: () => approvalsApi.requests.get(id as string),
    enabled: !!id,
  });

  const decideMutation = useMutation({
    mutationFn: ({ decision }: { decision: "APPROVED" | "REJECTED" }) => approvalsApi.requests.decide(id as string, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", "requests"] });
      toast({ title: t("approvals.decisionRecorded"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handleDecide = async (decision: "APPROVED" | "REJECTED") => {
    const ok = await confirm({
      title: t("approvals.decideConfirmTitle"),
      description: decision === "APPROVED" ? t("approvals.approveConfirmBody") : t("approvals.rejectConfirmBody"),
      confirmLabel: decision === "APPROVED" ? t("approvals.approve") : t("approvals.reject"),
      destructive: decision === "REJECTED",
    });
    if (ok) decideMutation.mutate({ decision });
  };

  const req = query.data;
  const currentStepDef = req?.workflow.steps.find((s) => s.stepOrder === req.currentStep);

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{req?.workflow.name ?? ""}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {query.isPending ? (
            <Skeleton className="h-40" />
          ) : req ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">{t("approvals.docType")}</p>
                  <p className="font-mono text-xs">{req.docType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">{t("approvals.docId")}</p>
                  <p className="font-mono text-xs">{req.docId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">{t("approvals.requestStatus")}</p>
                  <Badge variant={STATUS_VARIANT[req.status]}>{t(`approvals.status_${req.status}`)}</Badge>
                </div>
                {req.status === "PENDING" && (
                  <div>
                    <p className="text-xs text-muted">{t("approvals.currentStep")}</p>
                    <p>
                      {req.currentStep} / {req.workflow.steps.length} — {currentStepDef?.name}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted">{t("approvals.actionHistory")}</p>
                {req.actions.length === 0 ? (
                  <p className="text-sm text-muted">{t("approvals.noActionsYet")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {req.actions.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <Badge variant={a.decision === "APPROVED" ? "success" : "error"}>{t(`approvals.status_${a.decision}`)}</Badge>
                        <span className="text-xs text-muted">{formatDateTime(a.actedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogBody>
        {req?.status === "PENDING" && hasPermission("core.approval_workflow.update") && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDecide("REJECTED")} loading={decideMutation.isPending}>
              <X className="size-4" />
              {t("approvals.reject")}
            </Button>
            <Button onClick={() => handleDecide("APPROVED")} loading={decideMutation.isPending}>
              <Check className="size-4" />
              {t("approvals.approve")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
