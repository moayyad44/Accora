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
import { purchasingApi, type PurchaseInvoice, type PurchaseDocStatus } from "@/api/purchasing";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<PurchaseDocStatus, "neutral" | "success" | "error" | "info"> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  PARTIALLY_RECEIVED: "info",
  RECEIVED: "info",
  POSTED: "success",
  CANCELLED: "error",
};

export function PurchaseInvoicesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const query = useQuery({ queryKey: ["purchasing", "invoices"], queryFn: purchasingApi.invoices.list });

  const columns: ColumnDef<PurchaseInvoice>[] = [
    { accessorKey: "invoiceNumber", header: t("sales.invoiceNumber") },
    { accessorKey: "invoiceDate", header: t("sales.invoiceDate"), cell: (c) => formatDate(c.getValue<string>()) },
    { id: "supplier", header: t("purchasing.supplier"), cell: ({ row }) => row.original.supplier?.name ?? "—" },
    {
      accessorKey: "total",
      header: t("sales.total"),
      cell: (c) => <span className="tabular-nums">{formatAmount(c.getValue<string>())}</span>,
    },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`sales.status_${row.original.status}`, row.original.status)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("purchasing.invoices")}
        description={t("purchasing.invoicesDesc")}
        breadcrumbs={[{ label: t("nav.purchasing") }, { label: t("purchasing.invoices") }]}
        actions={
          hasPermission("purchasing.purchase_invoice.create") && (
            <Button onClick={() => navigate("/purchasing/invoices/new")}>
              <Plus className="size-4" />
              {t("purchasing.newInvoice")}
            </Button>
          )
        }
      />

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
          onRowClick={(inv) => navigate(`/purchasing/invoices/${inv.id}`)}
        />
      )}
    </div>
  );
}
