import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";

export function TrialBalancePage() {
  const { t } = useTranslation();
  const [asOfDate, setAsOfDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ["accounting", "reports", "trial-balance", asOfDate],
    queryFn: () => accountingApi.reports.trialBalance(asOfDate),
  });

  return (
    <div>
      <PageHeader
        title={t("accounting.trialBalance")}
        description={t("accounting.trialBalanceDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.trialBalance") }]}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("common.print")}
          </Button>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asOfDate">{t("accounting.asOfDate")}</Label>
          <Input id="asOfDate" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-48" />
        </div>
      </div>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.code")}</TableHead>
                <TableHead>{t("accounting.name")}</TableHead>
                <TableHead className="text-end">{t("accounting.totalDebit")}</TableHead>
                <TableHead className="text-end">{t("accounting.totalCredit")}</TableHead>
                <TableHead className="text-end">{t("accounting.balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.rows.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row.totalDebit)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row.totalCredit)}</TableCell>
                  <TableCell className="text-end font-medium tabular-nums">{formatAmount(row.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-6 border-t border-border bg-surface-sunken px-3 py-2.5 text-sm font-semibold">
            <span>
              {t("accounting.totalDebit")}: <span className="tabular-nums">{formatAmount(query.data.totalDebit)}</span>
            </span>
            <span>
              {t("accounting.totalCredit")}: <span className="tabular-nums">{formatAmount(query.data.totalCredit)}</span>
            </span>
          </div>
        </TableContainer>
      )}
    </div>
  );
}
