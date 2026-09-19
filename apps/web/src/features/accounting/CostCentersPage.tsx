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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { accountingApi, type CostCenter } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  parentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CostCentersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["accounting", "cost-centers"], queryFn: accountingApi.costCenters.list });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: accountingApi.costCenters.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "cost-centers"] });
      toast({ title: t("accounting.costCenterCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const parentName = (id: string | null) => query.data?.find((c) => c.id === id)?.name ?? "—";

  const columns: ColumnDef<CostCenter>[] = [
    { accessorKey: "code", header: t("accounting.code"), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: "name", header: t("accounting.name") },
    { id: "parent", header: t("accounting.parentAccount"), cell: ({ row }) => parentName(row.original.parentId) },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "neutral"}>
          {row.original.isActive ? t("accounting.active") : t("accounting.inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("accounting.costCenters")}
        description={t("accounting.costCentersDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.costCenters") }]}
        actions={
          hasPermission("accounting.cost_center.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("accounting.addCostCenter")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("accounting.searchAccounts")} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("accounting.addCostCenter")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("accounting.code")} htmlFor="cc-code" error={form.formState.errors.code?.message}>
                <Input id="cc-code" {...form.register("code")} />
              </FormField>
              <FormField label={t("accounting.nameEn")} htmlFor="cc-name" error={form.formState.errors.name?.message}>
                <Input id="cc-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="cc-nameAr">
                <Input id="cc-nameAr" dir="rtl" {...form.register("nameAr")} />
              </FormField>
              <FormField label={t("accounting.parentAccount")} htmlFor="cc-parentId">
                <Controller
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                      <SelectTrigger id="cc-parentId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("accounting.noParent")}</SelectItem>
                        {query.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.name}
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
