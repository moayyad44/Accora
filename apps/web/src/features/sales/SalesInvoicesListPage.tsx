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
import { salesApi, type SalesInvoice, type SalesDocStatus } from "@/api/sales";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<SalesDocStatus, "neutral" | "success" | "error" | "info"> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  POSTED: "success",
  CANCELLED: "error",
};

export function SalesInvoicesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const query = useQuery({ queryKey: ["sales", "invoices"], queryFn: salesApi.invoices.list });

  const columns: ColumnDef<SalesInvoice>[] = [
    { accessorKey: "invoiceNumber", header: t("sales.invoiceNumber") },
    { accessorKey: "invoiceDate", header: t("sales.invoiceDate"), cell: (c) => formatDate(c.getValue<string>()) },
    { id: "customer", header: t("sales.customer"), cell: ({ row }) => row.original.customer?.name ?? "—" },
    {
      accessorKey: "total",
      header: t("sales.total"),
      cell: (c) => <span className="tabular-nums">{formatAmount(c.getValue<string>())}</span>,
    },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`sales.status_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("sales.invoices")}
        description={t("sales.invoicesDesc")}
        breadcrumbs={[{ label: t("nav.sales") }, { label: t("sales.invoices") }]}
        actions={
          hasPermission("sales.sales_invoice.create") && (
            <Button onClick={() => navigate("/sales/invoices/new")}>
              <Plus className="size-4" />
              {t("sales.newInvoice")}
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
          onRowClick={(inv) => navigate(`/sales/invoices/${inv.id}`)}
        />
      )}
    </div>
  );
}
