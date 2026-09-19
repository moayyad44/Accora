import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableContainer, TableRow } from "@/components/ui/table";
import { accountingApi, type BalanceSheetRow } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";

function Section({ title, rows, total }: { title: string; rows: BalanceSheetRow[]; total: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TableContainer className="border-0">
          <Table>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
      <div className="flex justify-between border-t border-border bg-surface-sunken px-4 py-2.5 text-sm font-semibold">
        <span>{title}</span>
        <span className="tabular-nums">{formatAmount(total)}</span>
      </div>
    </Card>
  );
}

export function BalanceSheetPage() {
  const { t } = useTranslation();
  const [asOfDate, setAsOfDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ["accounting", "reports", "balance-sheet", asOfDate],
    queryFn: () => accountingApi.reports.balanceSheet(asOfDate),
  });

  return (
    <div>
      <PageHeader
        title={t("accounting.balanceSheet")}
        description={t("accounting.balanceSheetDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.balanceSheet") }]}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("common.print")}
          </Button>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-date">{t("accounting.asOfDate")}</Label>
          <Input id="bs-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-48" />
        </div>
      </div>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={query.data.isBalanced ? "success" : "error"}>
              {query.data.isBalanced ? t("accounting.balanced") : t("accounting.unbalanced")}
            </Badge>
          </div>

          <div className="grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title={t("accounting.assets")} rows={query.data.assets} total={query.data.totalAssets} />
            <div className="flex flex-col gap-4">
              <Section title={t("accounting.liabilities")} rows={query.data.liabilities} total={query.data.totalLiabilities} />
              <Section
                title={t("accounting.equity")}
                rows={[
                  ...query.data.equity,
                  { accountId: "net-income", code: "", name: t("accounting.netIncomeUndistributed"), nameAr: null, balance: query.data.netIncomeUndistributed },
                ]}
                total={query.data.totalEquity}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
