import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { manufacturingApi, type WorkCenter } from "@/api/manufacturing";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  costPerHour: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function WorkCentersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["manufacturing", "work-centers"], queryFn: manufacturingApi.workCenters.list });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: manufacturingApi.workCenters.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing", "work-centers"] });
      toast({ title: t("manufacturing.workCenterCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<WorkCenter>[] = [
    { accessorKey: "name", header: t("accounting.name") },
    {
      id: "costPerHour",
      header: t("manufacturing.costPerHour"),
      cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.costPerHour)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("manufacturing.workCenters")}
        description={t("manufacturing.workCentersDesc")}
        breadcrumbs={[{ label: t("nav.manufacturing") }, { label: t("manufacturing.workCenters") }]}
        actions={
          hasPermission("manufacturing.work_center.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("manufacturing.addWorkCenter")}
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
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("manufacturing.addWorkCenter")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("accounting.nameEn")} htmlFor="wc-name" error={form.formState.errors.name?.message}>
                <Input id="wc-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="wc-nameAr">
                <Input id="wc-nameAr" dir="rtl" {...form.register("nameAr")} />
              </FormField>
              <FormField label={t("manufacturing.costPerHour")} htmlFor="wc-costPerHour">
                <Input id="wc-costPerHour" inputMode="decimal" placeholder="0.00" {...form.register("costPerHour")} />
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
