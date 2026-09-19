import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { inventoryApi, type ExpiringBatch } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";

export function ExpiringBatchesPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["inventory", "expiring-batches"], queryFn: () => inventoryApi.batches.expiring() });

  const columns: ColumnDef<ExpiringBatch>[] = [
    { id: "sku", header: t("catalog.sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
    { id: "name", header: t("accounting.name"), cell: ({ row }) => row.original.item.name },
    { accessorKey: "batchNumber", header: t("inventory.batchNumber") },
    {
      id: "expiryDate",
      header: t("inventory.expiryDate"),
      cell: ({ row }) => (row.original.expiryDate ? formatDate(row.original.expiryDate) : "—"),
    },
    {
      id: "remainingQty",
      header: t("inventory.remainingQty"),
      cell: ({ row }) => <span className="tabular-nums">{formatAmount(row.original.remainingQty, 4)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("inventory.expiringBatches")}
        description={t("inventory.expiringBatchesDesc")}
        breadcrumbs={[{ label: t("nav.inventory") }, { label: t("inventory.expiringBatches") }]}
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} />
      )}
    </div>
  );
}
