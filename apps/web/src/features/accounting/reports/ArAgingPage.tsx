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
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";

export function ArAgingPage() {
  const { t } = useTranslation();
  const [asOfDate, setAsOfDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ["accounting", "reports", "ar-aging", asOfDate],
    queryFn: () => accountingApi.reports.arAging(asOfDate),
  });

  return (
    <div>
      <PageHeader
        title={t("accounting.arAging")}
        description={t("accounting.arAgingDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.arAging") }]}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("common.print")}
          </Button>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ar-date">{t("accounting.asOfDate")}</Label>
          <Input id="ar-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-48" />
        </div>
      </div>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.data.byCustomer.length === 0 ? (
        <EmptyState title={t("common.noData")} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.code")}</TableHead>
                <TableHead>{t("sales.customer")}</TableHead>
                <TableHead className="text-end">{t("accounting.bucketCurrent")}</TableHead>
                <TableHead className="text-end">{t("accounting.bucket1to30")}</TableHead>
                <TableHead className="text-end">{t("accounting.bucket31to60")}</TableHead>
                <TableHead className="text-end">{t("accounting.bucket61to90")}</TableHead>
                <TableHead className="text-end">{t("accounting.bucket90plus")}</TableHead>
                <TableHead className="text-end">{t("common.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.byCustomer.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row.current)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row["1-30"])}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row["31-60"])}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row["61-90"])}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatAmount(row["90+"])}</TableCell>
                  <TableCell className="text-end font-medium tabular-nums">{formatAmount(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t border-border bg-surface-sunken px-3 py-2.5 text-sm font-semibold">
            <span>
              {t("accounting.grandTotal")}: <span className="tabular-nums">{formatAmount(query.data.grandTotal)}</span>
            </span>
          </div>
        </TableContainer>
      )}
    </div>
  );
}
