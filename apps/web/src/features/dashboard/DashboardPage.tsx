import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Banknote, ReceiptText, Wallet, TrendingUp, TrendingDown, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "@/api/dashboard";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "error";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">{label}</p>
          <p
            className={cn(
              "mt-1.5 text-xl font-semibold tabular-nums",
              tone === "success" && "text-success",
              tone === "error" && "text-error",
              tone === "neutral" && "text-foreground",
            )}
          >
            {value}
          </p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-md bg-primary-subtle text-primary">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => dashboardApi.summary(),
  });

  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403;
    return (
      <Alert variant="error" title={forbidden ? t("common.forbiddenTitle") : t("common.errorTitle")}>
        <div className="flex items-center justify-between gap-3">
          <span>{forbidden ? t("common.forbiddenBody") : t("common.errorGeneric")}</span>
          {!forbidden && (
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              {t("common.retry")}
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  const d = query.data;
  const netIncome = Number(d.periodNetIncome);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("nav.dashboard")}</h1>
        <p className="text-sm text-muted">
          {d.currentPeriod ? d.currentPeriod.name : "لا توجد فترة محاسبية مفتوحة"} — حتى تاريخ {formatDate(d.asOfDate)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard icon={Wallet} label="النقدية والبنوك" value={formatAmount(d.totalCashAndBank)} />
        <KpiCard icon={Banknote} label="الذمم المدينة" value={formatAmount(d.totalAccountsReceivable)} />
        <KpiCard icon={ReceiptText} label="الذمم الدائنة" value={formatAmount(d.totalAccountsPayable)} />
        <KpiCard icon={TrendingUp} label="إيرادات الفترة الحالية" value={formatAmount(d.periodRevenue)} tone="success" />
        <KpiCard icon={TrendingDown} label="مصروفات الفترة الحالية" value={formatAmount(d.periodExpenses)} tone="error" />
        <KpiCard
          icon={Scale}
          label="صافي الربح للفترة الحالية"
          value={formatAmount(d.periodNetIncome)}
          tone={netIncome >= 0 ? "success" : "error"}
        />
      </div>
    </div>
  );
}
