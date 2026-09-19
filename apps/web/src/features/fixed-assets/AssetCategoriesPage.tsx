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
import { fixedAssetsApi, type AssetCategory } from "@/api/fixed-assets";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  defaultDepreciationMethod: z.enum(["STRAIGHT_LINE", "DECLINING_BALANCE"]),
  defaultUsefulLifeMonths: z.string().min(1),
  assetAccountId: z.string().min(1),
  depreciationExpenseAccountId: z.string().min(1),
  accumulatedDepreciationAccountId: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function AssetCategoriesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["fixed-assets", "categories"], queryFn: fixedAssetsApi.categories.list });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { defaultDepreciationMethod: "STRAIGHT_LINE" },
  });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) =>
      fixedAssetsApi.categories.create({ ...v, defaultUsefulLifeMonths: Number(v.defaultUsefulLifeMonths) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", "categories"] });
      toast({ title: t("fixedAssets.categoryCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset({ defaultDepreciationMethod: "STRAIGHT_LINE" });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<AssetCategory>[] = [
    { accessorKey: "name", header: t("accounting.name") },
    {
      id: "method",
      header: t("fixedAssets.defaultDepreciationMethod"),
      cell: ({ row }) => t(`fixedAssets.method_${row.original.defaultDepreciationMethod}`),
    },
    { id: "life", header: t("fixedAssets.defaultUsefulLifeMonths"), cell: ({ row }) => row.original.defaultUsefulLifeMonths },
    { id: "assetAccount", header: t("fixedAssets.assetAccount"), cell: ({ row }) => row.original.assetAccount.name },
  ];

  return (
    <div>
      <PageHeader
        title={t("fixedAssets.categories")}
        description={t("fixedAssets.categoriesDesc")}
        breadcrumbs={[{ label: t("nav.fixedAssets") }, { label: t("fixedAssets.categories") }]}
        actions={
          hasPermission("fixed_assets.asset_category.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset({ defaultDepreciationMethod: "STRAIGHT_LINE" });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("fixedAssets.addCategory")}
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
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("fixedAssets.addCategory")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.nameEn")} htmlFor="cat-name" error={form.formState.errors.name?.message}>
                  <Input id="cat-name" {...form.register("name")} />
                </FormField>
                <FormField label={t("accounting.nameAr")} htmlFor="cat-nameAr">
                  <Input id="cat-nameAr" dir="rtl" {...form.register("nameAr")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fixedAssets.defaultDepreciationMethod")} htmlFor="cat-method">
                  <Controller
                    control={form.control}
                    name="defaultDepreciationMethod"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="cat-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STRAIGHT_LINE">{t("fixedAssets.method_STRAIGHT_LINE")}</SelectItem>
                          <SelectItem value="DECLINING_BALANCE">{t("fixedAssets.method_DECLINING_BALANCE")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField
                  label={t("fixedAssets.defaultUsefulLifeMonths")}
                  htmlFor="cat-life"
                  error={form.formState.errors.defaultUsefulLifeMonths?.message}
                >
                  <Input id="cat-life" inputMode="numeric" {...form.register("defaultUsefulLifeMonths")} />
                </FormField>
              </div>
              <FormField
                label={t("fixedAssets.assetAccount")}
                htmlFor="cat-assetAccount"
                error={form.formState.errors.assetAccountId?.message}
              >
                <Controller
                  control={form.control}
                  name="assetAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cat-assetAccount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {postableAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField
                label={t("fixedAssets.depreciationExpenseAccount")}
                htmlFor="cat-depExpAccount"
                error={form.formState.errors.depreciationExpenseAccountId?.message}
              >
                <Controller
                  control={form.control}
                  name="depreciationExpenseAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cat-depExpAccount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {postableAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField
                label={t("fixedAssets.accumulatedDepreciationAccount")}
                htmlFor="cat-accumDepAccount"
                error={form.formState.errors.accumulatedDepreciationAccountId?.message}
              >
                <Controller
                  control={form.control}
                  name="accumulatedDepreciationAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cat-accumDepAccount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {postableAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
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
