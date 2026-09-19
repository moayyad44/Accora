import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { accountingApi, type JournalEntryStatus } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<JournalEntryStatus, "neutral" | "success" | "error"> = {
  DRAFT: "neutral",
  POSTED: "success",
  REVERSED: "error",
};

export function JournalEntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["accounting", "journal-entries", id],
    queryFn: () => accountingApi.journalEntries.get(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => accountingApi.journalEntries.post(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal-entries"] });
      toast({ title: t("accounting.entryPosted"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const reverseMutation = useMutation({
    mutationFn: () => accountingApi.journalEntries.reverse(id!),
    onSuccess: (reversal) => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal-entries"] });
      toast({ title: t("accounting.entryReversed"), variant: "success" });
      navigate(`/accounting/journal-entries/${reversal.id}`);
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
      title: t("accounting.postConfirmTitle"),
      description: t("accounting.postConfirmBody"),
      confirmLabel: t("accounting.postEntry"),
    });
    if (ok) postMutation.mutate();
  };

  const handleReverse = async () => {
    const ok = await confirm({
      title: t("accounting.reverseConfirmTitle"),
      description: t("accounting.reverseConfirmBody"),
      confirmLabel: t("accounting.reverseEntry"),
      destructive: true,
    });
    if (ok) reverseMutation.mutate();
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

  const entry = query.data;
  const totalDebit = entry.lines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
  const totalCredit = entry.lines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));

  return (
    <div>
      <PageHeader
        title={entry.entryNumber}
        breadcrumbs={[
          { label: t("nav.accounting") },
          { label: t("accounting.journalEntries"), to: "/accounting/journal-entries" },
          { label: entry.entryNumber },
        ]}
        actions={
          <>
            {entry.status === "DRAFT" && hasPermission("accounting.journal_entry.post") && (
              <Button onClick={handlePost} loading={postMutation.isPending}>
                {t("accounting.postEntry")}
              </Button>
            )}
            {entry.status === "POSTED" && hasPermission("accounting.journal_entry.post") && (
              <Button variant="danger" onClick={handleReverse} loading={reverseMutation.isPending}>
                {t("accounting.reverseEntry")}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("accounting.entryDate")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(entry.entryDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[entry.status]}>{t(`accounting.status_${entry.status}`)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted">{t("accounting.sourceType")}</p>
            <p className="text-sm font-medium text-foreground">{t(`accounting.source_${entry.sourceType}`)}</p>
          </div>
          {entry.postedAt && (
            <div>
              <p className="text-xs text-muted">{t("accounting.postEntry")}</p>
              <p className="text-sm font-medium text-foreground">{formatDateTime(entry.postedAt)}</p>
            </div>
          )}
          {entry.description && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted">{t("accounting.description")}</p>
              <p className="text-sm font-medium text-foreground">{entry.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("accounting.account")}</TableHead>
              <TableHead>{t("accounting.costCenter")}</TableHead>
              <TableHead>{t("accounting.description")}</TableHead>
              <TableHead className="text-end">{t("accounting.debit")}</TableHead>
              <TableHead className="text-end">{t("accounting.credit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entry.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  {line.account ? `${line.account.code} — ${line.account.name}` : "—"}
                </TableCell>
                <TableCell>{line.costCenter?.name ?? "—"}</TableCell>
                <TableCell className="text-muted">{line.description ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{Number(line.debit) > 0 ? formatAmount(line.debit) : "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{Number(line.credit) > 0 ? formatAmount(line.credit) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <div className="mt-3 flex justify-end gap-6 text-sm">
        <span className="text-muted">
          {t("accounting.totalDebit")}: <span className="font-semibold tabular-nums text-foreground">{formatAmount(totalDebit.toString())}</span>
        </span>
        <span className="text-muted">
          {t("accounting.totalCredit")}: <span className="font-semibold tabular-nums text-foreground">{formatAmount(totalCredit.toString())}</span>
        </span>
      </div>
    </div>
  );
}
