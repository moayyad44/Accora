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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { catalogApi, type Item } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const unitSchema = z.object({ code: z.string().min(1), name: z.string().min(1), nameAr: z.string().optional() });
type UnitFormValues = z.infer<typeof unitSchema>;

const ITEM_TYPES = ["TRADING", "RAW_MATERIAL", "SEMI_FINISHED", "FINISHED_GOOD", "SERVICE"] as const;

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  baseUnitId: z.string().min(1),
  itemType: z.enum(ITEM_TYPES),
  barcode: z.string().optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

function AddUnitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<UnitFormValues>({ resolver: zodResolver(unitSchema) });

  const mutation = useMutation({
    mutationFn: catalogApi.units.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", "units"] });
      toast({ title: t("catalog.unitCreated"), variant: "success" });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("catalog.addUnit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <DialogBody className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}
            <FormField label={t("accounting.code")} htmlFor="unit-code" error={form.formState.errors.code?.message} hint="مثال: PCS، KG، BOX">
              <Input id="unit-code" {...form.register("code")} />
            </FormField>
            <FormField label={t("accounting.nameEn")} htmlFor="unit-name" error={form.formState.errors.name?.message}>
              <Input id="unit-name" {...form.register("name")} />
            </FormField>
            <FormField label={t("accounting.nameAr")} htmlFor="unit-nameAr">
              <Input id="unit-nameAr" dir="rtl" {...form.register("nameAr")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ItemsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ["catalog", "items"], queryFn: catalogApi.items.list });
  const unitsQuery = useQuery({ queryKey: ["catalog", "units"], queryFn: catalogApi.units.list });

  const form = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema), defaultValues: { itemType: "TRADING" } });

  const createMutation = useMutation({
    mutationFn: catalogApi.items.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", "items"] });
      toast({ title: t("catalog.itemCreated"), variant: "success" });
      setItemDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const unitName = (id: string) => unitsQuery.data?.find((u) => u.id === id)?.code ?? "—";
  const hasUnits = (unitsQuery.data?.length ?? 0) > 0;

  const columns: ColumnDef<Item>[] = [
    { accessorKey: "sku", header: t("catalog.sku"), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: "name", header: t("accounting.name") },
    { id: "unit", header: t("catalog.unit"), cell: ({ row }) => unitName(row.original.baseUnitId) },
    { id: "itemType", header: t("catalog.itemType"), cell: ({ row }) => <Badge variant="info">{t(`catalog.itemType_${row.original.itemType}`)}</Badge> },
    { id: "tracking", header: t("common.status"), cell: ({ row }) => <Badge variant="neutral">{t(`catalog.trackingType_${row.original.trackingType}`)}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title={t("catalog.items")}
        description={t("catalog.itemsDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("catalog.items") }]}
        actions={
          hasPermission("inventory.item.create") && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setUnitDialogOpen(true)}>
                {t("catalog.addUnit")}
              </Button>
              <Button
                onClick={() => {
                  setServerError(null);
                  form.reset();
                  setItemDialogOpen(true);
                }}
                disabled={!hasUnits}
              >
                <Plus className="size-4" />
                {t("catalog.addItem")}
              </Button>
            </div>
          )
        }
      />

      {!unitsQuery.isPending && !hasUnits && <Alert variant="warning" className="mb-4">{t("catalog.manageUnitsFirst")}</Alert>}

      {itemsQuery.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {itemsQuery.error instanceof ApiError && itemsQuery.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={itemsQuery.data ?? []} isLoading={itemsQuery.isPending} searchPlaceholder={t("common.search")} />
      )}

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("catalog.addItem")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("catalog.sku")} htmlFor="item-sku" error={form.formState.errors.sku?.message}>
                <Input id="item-sku" {...form.register("sku")} />
              </FormField>
              <FormField label={t("accounting.nameEn")} htmlFor="item-name" error={form.formState.errors.name?.message}>
                <Input id="item-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="item-nameAr">
                <Input id="item-nameAr" dir="rtl" {...form.register("nameAr")} />
              </FormField>
              <FormField label={t("catalog.unit")} htmlFor="item-unit" error={form.formState.errors.baseUnitId?.message}>
                <Controller
                  control={form.control}
                  name="baseUnitId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="item-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitsQuery.data?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.code} — {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label={t("catalog.itemType")} htmlFor="item-type">
                <Controller
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="item-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((it) => (
                          <SelectItem key={it} value={it}>
                            {t(`catalog.itemType_${it}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddUnitDialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen} />
    </div>
  );
}
