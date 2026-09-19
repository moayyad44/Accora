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
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { hrApi, type Position } from "@/api/hr";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  title: z.string().min(1),
  titleAr: z.string().optional(),
  departmentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function PositionsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["hr", "positions"], queryFn: hrApi.positions.list });
  const departmentsQuery = useQuery({ queryKey: ["hr", "departments"], queryFn: hrApi.departments.list });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: hrApi.positions.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "positions"] });
      toast({ title: t("hr.positionCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<Position>[] = [
    { accessorKey: "title", header: t("hr.positionTitle") },
    { id: "department", header: t("hr.department"), cell: ({ row }) => row.original.department?.name ?? t("hr.noDepartment") },
  ];

  return (
    <div>
      <PageHeader
        title={t("hr.positions")}
        description={t("hr.positionsDesc")}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.positions") }]}
        actions={
          hasPermission("hr.department.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("hr.addPosition")}
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
            <DialogTitle>{t("hr.addPosition")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("hr.positionTitle")} htmlFor="pos-title" error={form.formState.errors.title?.message}>
                <Input id="pos-title" {...form.register("title")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="pos-titleAr">
                <Input id="pos-titleAr" dir="rtl" {...form.register("titleAr")} />
              </FormField>
              <FormField label={t("hr.department")} htmlFor="pos-departmentId">
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                      <SelectTrigger id="pos-departmentId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("hr.noDepartment")}</SelectItem>
                        {departmentsQuery.data?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
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
