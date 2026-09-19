import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useToast } from "@/components/ui/toast";
import { fixedAssetsApi, type RunDepreciationResult } from "@/api/fixed-assets";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";

export function DepreciationRunPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [periodId, setPeriodId] = React.useState<string>("");
  const [result, setResult] = React.useState<RunDepreciationResult | null>(null);

  const fiscalYearsQuery = useQuery({ queryKey: ["accounting", "fiscal-years"], queryFn: accountingApi.fiscalYears.list });
  const periods = (fiscalYearsQuery.data ?? []).flatMap((fy) =>
    fy.periods.map((p) => ({ ...p, fiscalYearName: fy.name })),
  );

  const runMutation = useMutation({
    mutationFn: () => fixedAssetsApi.depreciationRuns.run(periodId),
    onSuccess: (res) => {
      setResult(res);
      toast({ title: t("fixedAssets.runSuccess"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handleRun = async () => {
    const ok = await confirm({
      title: t("fixedAssets.runConfirmTitle"),
      description: t("fixedAssets.runConfirmBody"),
      confirmLabel: t("fixedAssets.runDepreciation"),
    });
    if (ok) {
      setResult(null);
      runMutation.mutate();
    }
  };

  if (fiscalYearsQuery.isPending) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        title={t("fixedAssets.depreciationRuns")}
        description={t("fixedAssets.depreciationRunsDesc")}
        breadcrumbs={[{ label: t("nav.fixedAssets") }, { label: t("fixedAssets.depreciationRuns") }]}
      />

      {periods.length === 0 ? (
        <Alert variant="warning">{t("fixedAssets.noPeriodsWarning")}</Alert>
      ) : (
        <Card className="max-w-lg">
          <CardContent className="flex flex-col gap-4">
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger>
                <SelectValue placeholder={t("fixedAssets.selectPeriod")} />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fiscalYearName} — {p.name} ({formatDate(p.startDate)} – {formatDate(p.endDate)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {result && (
              <Alert variant={result.schedulesCreated > 0 ? "success" : "info"}>
                {result.schedulesCreated > 0
                  ? `${t("fixedAssets.schedulesCreated")}: ${result.schedulesCreated}`
                  : t("fixedAssets.noSchedulesCreated")}
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleRun} loading={runMutation.isPending} disabled={!periodId}>
              {t("fixedAssets.runDepreciation")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
