import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { accountingApi, type AccountMapping } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

export function AccountMappingsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["accounting", "account-mappings"], queryFn: accountingApi.accountMappings.list });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const setMutation = useMutation({
    mutationFn: ({ key, accountId }: { key: string; accountId: string }) => accountingApi.accountMappings.set(key, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "account-mappings"] });
      toast({ title: t("settings.mappingUpdated"), variant: "success" });
    },
    onError: (err) =>
      toast({
        title: t("common.errorTitle"),
        description: err instanceof ApiError ? err.message : t("common.errorGeneric"),
        variant: "error",
      }),
  });

  const canEdit = hasPermission("accounting.account_mapping.update");

  const columns: ColumnDef<AccountMapping>[] = [
    { accessorKey: "key", header: t("settings.mappingKey"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.key}</span> },
    {
      id: "account",
      header: t("banking.glAccount"),
      cell: ({ row }) =>
        canEdit ? (
          <Select
            value={row.original.accountId}
            onValueChange={(accountId) => setMutation.mutate({ key: row.original.key, accountId })}
          >
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {postableAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span>
            {row.original.account.code} — {row.original.account.name}
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("settings.accountMappings")}
        description={t("settings.accountMappingsDesc")}
        breadcrumbs={[{ label: t("nav.settings") }, { label: t("settings.accountMappings") }]}
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}
    </div>
  );
}
