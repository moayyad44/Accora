import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountingApi, type JournalEntry, type JournalEntryStatus } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";
import Decimal from "decimal.js";

const STATUS_VARIANT: Record<JournalEntryStatus, "neutral" | "success" | "error"> = {
  DRAFT: "neutral",
  POSTED: "success",
  REVERSED: "error",
};

export function JournalEntriesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<JournalEntryStatus | "ALL">("ALL");

  const query = useQuery({
    queryKey: ["accounting", "journal-entries", statusFilter],
    queryFn: () => accountingApi.journalEntries.list(statusFilter === "ALL" ? undefined : statusFilter),
  });

  const columns: ColumnDef<JournalEntry>[] = [
    { accessorKey: "entryNumber", header: t("accounting.entryNumber") },
    {
      accessorKey: "entryDate",
      header: t("accounting.entryDate"),
      cell: (c) => formatDate(c.getValue<string>()),
    },
    { accessorKey: "description", header: t("accounting.description"), cell: (c) => c.getValue<string>() || "—" },
    {
      id: "sourceType",
      header: t("accounting.sourceType"),
      cell: ({ row }) => t(`accounting.source_${row.original.sourceType}`),
    },
    {
      id: "totalDebit",
      header: t("accounting.totalDebit"),
      cell: ({ row }) => {
        const total = row.original.lines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
        return <span className="tabular-nums">{formatAmount(total.toString())}</span>;
      },
    },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`accounting.status_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("accounting.journalEntries")}
        description={t("accounting.journalEntriesDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.journalEntries") }]}
        actions={
          hasPermission("accounting.journal_entry.create") && (
            <Button onClick={() => navigate("/accounting/journal-entries/new")}>
              <Plus className="size-4" />
              {t("accounting.newEntry")}
            </Button>
          )
        }
      />

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as JournalEntryStatus | "ALL")} className="mb-4">
        <TabsList>
          <TabsTrigger value="ALL">{t("common.viewAll")}</TabsTrigger>
          <TabsTrigger value="DRAFT">{t("accounting.status_DRAFT")}</TabsTrigger>
          <TabsTrigger value="POSTED">{t("accounting.status_POSTED")}</TabsTrigger>
          <TabsTrigger value="REVERSED">{t("accounting.status_REVERSED")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isPending}
          searchPlaceholder={t("common.search")}
          onRowClick={(entry) => navigate(`/accounting/journal-entries/${entry.id}`)}
        />
      )}
    </div>
  );
}
