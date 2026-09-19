import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { approvalsApi, type ApprovalWorkflow } from "@/api/approvals";
import { settingsApi } from "@/api/settings";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  docType: z.string().min(1),
  name: z.string().min(1),
  minAmount: z.string().optional(),
  steps: z.array(z.object({ name: z.string().min(1), approverRoleId: z.string().optional() })).min(1),
});
type FormValues = z.infer<typeof schema>;

export function ApprovalWorkflowsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["approvals", "workflows"], queryFn: () => approvalsApi.workflows.list() });
  const rolesQuery = useQuery({ queryKey: ["settings", "roles"], queryFn: settingsApi.roles.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { docType: "", name: "", minAmount: "", steps: [{ name: "", approverRoleId: undefined }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) =>
      approvalsApi.workflows.create({
        docType: v.docType,
        name: v.name,
        conditions: v.minAmount ? { minAmount: v.minAmount } : undefined,
        steps: v.steps.map((s) => ({ name: s.name, approverRoleId: s.approverRoleId || undefined })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", "workflows"] });
      toast({ title: t("approvals.workflowCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ docType: "", name: "", minAmount: "", steps: [{ name: "", approverRoleId: undefined }] });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<ApprovalWorkflow>[] = [
    { accessorKey: "name", header: t("approvals.workflowName") },
    { accessorKey: "docType", header: t("approvals.docType"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.docType}</span> },
    {
      id: "minAmount",
      header: t("approvals.minAmount"),
      cell: ({ row }) => row.original.conditions?.minAmount ?? "—",
    },
    { id: "steps", header: t("approvals.steps"), cell: ({ row }) => row.original.steps.length },
    {
      id: "isActive",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={row.original.isActive ? "success" : "neutral"}>{row.original.isActive ? t("accounting.active") : t("accounting.inactive")}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("approvals.workflows")}
        description={t("approvals.workflowsDesc")}
        breadcrumbs={[{ label: t("nav.approvals") }, { label: t("approvals.workflows") }]}
        actions={
          hasPermission("core.approval_workflow.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ docType: "", name: "", minAmount: "", steps: [{ name: "", approverRoleId: undefined }] });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("approvals.newWorkflow")}
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
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("approvals.newWorkflow")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("approvals.workflowName")} htmlFor="wf-name" error={form.formState.errors.name?.message}>
                  <Input id="wf-name" {...form.register("name")} />
                </FormField>
                <FormField label={t("approvals.docType")} htmlFor="wf-docType" error={form.formState.errors.docType?.message}>
                  <Input id="wf-docType" placeholder="PURCHASE_INVOICE" {...form.register("docType")} />
                </FormField>
              </div>
              <FormField label={t("approvals.minAmount")} htmlFor="wf-minAmount" hint={t("approvals.minAmountHint")}>
                <Input id="wf-minAmount" inputMode="decimal" placeholder="0.00" {...form.register("minAmount")} />
              </FormField>

              <div>
                <Label>{t("approvals.steps")}</Label>
                <div className="mt-2 flex flex-col gap-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_36px] items-start gap-2">
                      <Input placeholder={t("approvals.stepName")} {...form.register(`steps.${index}.name`)} />
                      <Controller
                        control={form.control}
                        name={`steps.${index}.approverRoleId`}
                        render={({ field: f }) => (
                          <Select value={f.value ?? "any"} onValueChange={(v) => f.onChange(v === "any" ? undefined : v)}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("approvals.approverRole")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t("approvals.anyApprover")}</SelectItem>
                              {rolesQuery.data?.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                        <Trash2 className="size-4 text-error" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ name: "", approverRoleId: undefined })}>
                  <Plus className="size-4" />
                  {t("approvals.addStep")}
                </Button>
              </div>
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
