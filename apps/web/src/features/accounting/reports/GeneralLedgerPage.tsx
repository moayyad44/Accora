import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Printer, BookOpenCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";

export function GeneralLedgerPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader).sort((a, b) => a.code.localeCompare(b.code));

  const ledgerQuery = useQuery({
    queryKey: ["accounting", "reports", "general-ledger", accountId, dateFrom, dateTo],
    queryFn: () => accountingApi.reports.generalLedger(accountId, dateFrom || undefined, dateTo || undefined),
    enabled: !!accountId,
  });

  return (
    <div>
      <PageHeader
        title={t("accounting.generalLedger")}
        description={t("accounting.generalLedgerDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.generalLedger") }]}
        actions={
          accountId && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              {t("common.print")}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ledger-account">{t("accounting.account")}</Label>
          <Select value={accountId} onValueChange={(v) => setSearchParams({ accountId: v })}>
            <SelectTrigger id="ledger-account" className="w-64">
              <SelectValue placeholder={t("accounting.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {postableAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ledger-from">{t("common.dateFrom")}</Label>
          <Input id="ledger-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ledger-to">{t("common.dateTo")}</Label>
          <Input id="ledger-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {!accountId ? (
        <EmptyState icon={BookOpenCheck} title={t("accounting.selectAccount")} />
      ) : ledgerQuery.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {ledgerQuery.error instanceof ApiError && ledgerQuery.error.status === 403
            ? t("common.forbiddenBody")
            : t("common.errorGeneric")}
        </Alert>
      ) : ledgerQuery.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.entryNumber")}</TableHead>
                <TableHead>{t("accounting.entryDate")}</TableHead>
                <TableHead>{t("accounting.description")}</TableHead>
                <TableHead className="text-end">{t("accounting.debit")}</TableHead>
                <TableHead className="text-end">{t("accounting.credit")}</TableHead>
                <TableHead className="text-end">{t("accounting.runningBalance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerQuery.data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title={t("common.noData")} />
                  </td>
                </tr>
              ) : (
                ledgerQuery.data.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.entryNumber}</TableCell>
                    <TableCell>{formatDate(row.entryDate)}</TableCell>
                    <TableCell className="text-muted">{row.description ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{Number(row.debit) > 0 ? formatAmount(row.debit) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{Number(row.credit) > 0 ? formatAmount(row.credit) : "—"}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums">{formatAmount(row.runningBalance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t border-border bg-surface-sunken px-3 py-2.5 text-sm font-semibold">
            {t("accounting.endingBalance")}: <span className="ms-2 tabular-nums">{formatAmount(ledgerQuery.data.endingBalance)}</span>
          </div>
        </TableContainer>
      )}
    </div>
  );
}
