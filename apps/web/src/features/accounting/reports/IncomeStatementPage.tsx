import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableContainer, TableRow } from "@/components/ui/table";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function firstDayOfYear() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function IncomeStatementPage() {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = React.useState(firstDayOfYear());
  const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ["accounting", "reports", "income-statement", dateFrom, dateTo],
    queryFn: () => accountingApi.reports.incomeStatement(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });

  return (
    <div>
      <PageHeader
        title={t("accounting.incomeStatement")}
        description={t("accounting.incomeStatementDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.incomeStatement") }]}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("common.print")}
          </Button>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="is-from">{t("common.dateFrom")}</Label>
          <Input id="is-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="is-to">{t("common.dateTo")}</Label>
          <Input id="is-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.revenue")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TableContainer className="border-0">
                <Table>
                  <TableBody>
                    {query.data.revenue.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
            <div className="flex justify-between border-t border-border bg-surface-sunken px-4 py-2.5 text-sm font-semibold">
              <span>{t("accounting.revenue")}</span>
              <span className="tabular-nums">{formatAmount(query.data.totalRevenue)}</span>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.expenses")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TableContainer className="border-0">
                <Table>
                  <TableBody>
                    {query.data.expenses.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatAmount(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
            <div className="flex justify-between border-t border-border bg-surface-sunken px-4 py-2.5 text-sm font-semibold">
              <span>{t("accounting.expenses")}</span>
              <span className="tabular-nums">{formatAmount(query.data.totalExpenses)}</span>
            </div>
          </Card>

          <Card>
            <CardContent
              className={cn(
                "flex items-center justify-between text-base font-bold",
                Number(query.data.netIncome) >= 0 ? "text-success" : "text-error",
              )}
            >
              <span>{t("accounting.netIncome")}</span>
              <span className="tabular-nums">{formatAmount(query.data.netIncome)}</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
