import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { manufacturingApi } from "@/api/manufacturing";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";

export function BomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["manufacturing", "boms", id],
    queryFn: () => manufacturingApi.boms.get(id!),
    enabled: !!id,
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
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

  const bom = query.data;

  return (
    <div>
      <PageHeader
        title={`${bom.item.sku} — ${bom.item.name} (v${bom.version})`}
        breadcrumbs={[
          { label: t("nav.manufacturing") },
          { label: t("manufacturing.boms"), to: "/manufacturing/boms" },
          { label: bom.item.sku },
        ]}
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("manufacturing.version")}</p>
            <p className="text-sm font-medium text-foreground">v{bom.version}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={bom.isActive ? "success" : "neutral"}>
              {bom.isActive ? t("accounting.active") : t("accounting.inactive")}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted">{t("manufacturing.createdAt")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(bom.createdAt)}</p>
          </div>
          {bom.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted">{t("manufacturing.notes")}</p>
              <p className="text-sm font-medium text-foreground">{bom.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("catalog.sku")}</TableHead>
              <TableHead>{t("manufacturing.component")}</TableHead>
              <TableHead className="text-end">{t("manufacturing.componentQty")}</TableHead>
              <TableHead>{t("catalog.unit")}</TableHead>
              <TableHead className="text-end">{t("manufacturing.scrapPercent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bom.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-mono text-xs">{line.componentItem.sku}</TableCell>
                <TableCell>{line.componentItem.name}</TableCell>
                <TableCell className="text-end tabular-nums">{formatAmount(line.qty, 4)}</TableCell>
                <TableCell>{line.unit.code}</TableCell>
                <TableCell className="text-end tabular-nums">{formatAmount(line.scrapPercent, 2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
