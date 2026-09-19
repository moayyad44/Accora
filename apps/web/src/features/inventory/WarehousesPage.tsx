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
import { useToast } from "@/components/ui/toast";
import { inventoryApi, type Warehouse } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function WarehousesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["inventory", "warehouses"], queryFn: inventoryApi.warehouses.list });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: inventoryApi.warehouses.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
      toast({ title: t("catalog.warehouseCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<Warehouse>[] = [
    { accessorKey: "code", header: t("accounting.code"), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: "name", header: t("accounting.name") },
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
        title={t("catalog.warehouses")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("catalog.warehouses") }]}
        actions={
          hasPermission("inventory.warehouse.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("catalog.addWarehouse")}
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
            <DialogTitle>{t("catalog.addWarehouse")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("accounting.code")} htmlFor="wh-code" error={form.formState.errors.code?.message}>
                <Input id="wh-code" {...form.register("code")} />
              </FormField>
              <FormField label={t("accounting.nameEn")} htmlFor="wh-name" error={form.formState.errors.name?.message}>
                <Input id="wh-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="wh-nameAr">
                <Input id="wh-nameAr" dir="rtl" {...form.register("nameAr")} />
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
