import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { fixedAssetsApi } from "@/api/fixed-assets";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";

const schema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  purchaseDate: z.string().min(1),
  usageStartDate: z.string().optional(),
  cost: z.string().min(1),
  salvageValue: z.string().optional(),
  usefulLifeMonths: z.string().optional(),
  depreciationMethod: z.enum(["STRAIGHT_LINE", "DECLINING_BALANCE"]).optional(),
  fundingAccountId: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function NewFixedAssetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const categoriesQuery = useQuery({ queryKey: ["fixed-assets", "categories"], queryFn: fixedAssetsApi.categories.list });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { purchaseDate: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) =>
      fixedAssetsApi.assets.register({
        categoryId: v.categoryId,
        name: v.name,
        nameAr: v.nameAr || undefined,
        purchaseDate: v.purchaseDate,
        usageStartDate: v.usageStartDate || undefined,
        cost: v.cost,
        salvageValue: v.salvageValue || undefined,
        usefulLifeMonths: v.usefulLifeMonths ? Number(v.usefulLifeMonths) : undefined,
        depreciationMethod: v.depreciationMethod,
        fundingAccountId: v.fundingAccountId,
      }),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", "assets"] });
      toast({ title: t("fixedAssets.assetRegistered"), variant: "success" });
      navigate(`/fixed-assets/assets/${asset.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const isLoading = categoriesQuery.isPending || accountsQuery.isPending;
  if (isLoading) return <Skeleton className="h-96" />;

  if ((categoriesQuery.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title={t("fixedAssets.onlyCategoryFirst")}
        action={
          <Button asChild variant="outline">
            <Link to="/fixed-assets/categories">{t("fixedAssets.categories")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={t("fixedAssets.registerAsset")}
        breadcrumbs={[
          { label: t("nav.fixedAssets") },
          { label: t("fixedAssets.assets"), to: "/fixed-assets/assets" },
          { label: t("fixedAssets.registerAsset") },
        ]}
      />

      <form onSubmit={form.handleSubmit((v) => { setServerError(null); createMutation.mutate(v); })}>
        <Card className="max-w-3xl">
          <CardContent className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fixedAssets.category")} htmlFor="categoryId" error={form.formState.errors.categoryId?.message}>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="categoryId">
                        <SelectValue placeholder={t("fixedAssets.category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesQuery.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label={t("fixedAssets.fundingAccount")} htmlFor="fundingAccountId" hint={t("fixedAssets.fundingAccountHint")} error={form.formState.errors.fundingAccountId?.message}>
                <Controller
                  control={form.control}
                  name="fundingAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="fundingAccountId">
                        <SelectValue placeholder={t("fixedAssets.fundingAccount")} />
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("accounting.nameEn")} htmlFor="name" error={form.formState.errors.name?.message}>
                <Input id="name" {...form.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="nameAr">
                <Input id="nameAr" dir="rtl" {...form.register("nameAr")} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fixedAssets.purchaseDate")} htmlFor="purchaseDate" error={form.formState.errors.purchaseDate?.message}>
                <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
              </FormField>
              <FormField label={t("fixedAssets.usageStartDate")} htmlFor="usageStartDate">
                <Input id="usageStartDate" type="date" {...form.register("usageStartDate")} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fixedAssets.cost")} htmlFor="cost" error={form.formState.errors.cost?.message}>
                <Input id="cost" inputMode="decimal" placeholder="0.00" {...form.register("cost")} />
              </FormField>
              <FormField label={t("fixedAssets.salvageValue")} htmlFor="salvageValue">
                <Input id="salvageValue" inputMode="decimal" placeholder="0.00" {...form.register("salvageValue")} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fixedAssets.usefulLifeMonths")} htmlFor="usefulLifeMonths" hint={t("fixedAssets.usefulLifeHint")}>
                <Input id="usefulLifeMonths" inputMode="numeric" {...form.register("usefulLifeMonths")} />
              </FormField>
              <FormField label={t("fixedAssets.depreciationMethod")} htmlFor="depreciationMethod">
                <Controller
                  control={form.control}
                  name="depreciationMethod"
                  render={({ field }) => (
                    <Select value={field.value ?? "default"} onValueChange={(v) => field.onChange(v === "default" ? undefined : v)}>
                      <SelectTrigger id="depreciationMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{t("fixedAssets.useCategoryDefault")}</SelectItem>
                        <SelectItem value="STRAIGHT_LINE">{t("fixedAssets.method_STRAIGHT_LINE")}</SelectItem>
                        <SelectItem value="DECLINING_BALANCE">{t("fixedAssets.method_DECLINING_BALANCE")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/fixed-assets/assets")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              {t("fixedAssets.registerAsset")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
