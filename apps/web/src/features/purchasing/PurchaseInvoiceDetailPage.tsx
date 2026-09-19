import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { purchasingApi, type PurchaseDocStatus } from "@/api/purchasing";
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

export function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["purchasing", "invoices", id],
    queryFn: () => purchasingApi.invoices.get(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => purchasingApi.invoices.post(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchasing", "invoices"] });
      toast({ title: t("purchasing.invoicePosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const handlePost = async () => {
    const ok = await confirm({
      title: t("purchasing.postConfirmTitle"),
      description: t("purchasing.postConfirmBody"),
      confirmLabel: t("sales.postInvoice"),
    });
    if (ok) postMutation.mutate();
  };

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="error" title={t("common.errorTitle")}>
        {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
      </Alert>
    );
  }

  const invoice = query.data;

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumbs={[
          { label: t("nav.purchasing") },
          { label: t("purchasing.invoices"), to: "/purchasing/invoices" },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          invoice.status === "DRAFT" &&
          hasPermission("purchasing.purchase_invoice.post") && (
            <Button onClick={handlePost} loading={postMutation.isPending}>
              {t("sales.postInvoice")}
            </Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("purchasing.supplier")}</p>
            <p className="text-sm font-medium text-foreground">{invoice.supplier?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("sales.invoiceDate")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(invoice.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[invoice.status]}>{t(`sales.status_${invoice.status}`, invoice.status)}</Badge>
          </div>
        </CardContent>
      </Card>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sales.item")}</TableHead>
              <TableHead className="text-end">{t("sales.qty")}</TableHead>
              <TableHead className="text-end">{t("purchasing.unitCost")}</TableHead>
              <TableHead className="text-end">{t("sales.tax")}</TableHead>
              <TableHead className="text-end">{t("sales.lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.item ? `${line.item.sku} — ${line.item.name}` : "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{line.qty}</TableCell>
                <TableCell className="text-end tabular-nums">{formatAmount(line.unitCost)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatAmount(line.taxAmount)}</TableCell>
                <TableCell className="text-end font-medium tabular-nums">{formatAmount(line.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-col items-end gap-1 border-t border-border bg-surface-sunken px-4 py-3 text-sm">
          <span className="text-muted">
            {t("sales.subtotal")}: <span className="tabular-nums text-foreground">{formatAmount(invoice.subtotal)}</span>
          </span>
          <span className="text-muted">
            {t("sales.tax")}: <span className="tabular-nums text-foreground">{formatAmount(invoice.taxTotal)}</span>
          </span>
          <span className="font-semibold">
            {t("sales.total")}: <span className="tabular-nums">{formatAmount(invoice.total)}</span>
          </span>
        </div>
      </TableContainer>
    </div>
  );
}
