import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, Search, ListTree } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { accountingApi, type Account } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { AccountFormDialog } from "./AccountFormDialog";

interface AccountNode extends Account {
  children: AccountNode[];
}

function buildTree(accounts: Account[]): AccountNode[] {
  const nodes = new Map<string, AccountNode>();
  accounts.forEach((a) => nodes.set(a.id, { ...a, children: [] }));
  const roots: AccountNode[] = [];
  for (const account of accounts) {
    const node = nodes.get(account.id)!;
    if (account.parentId && nodes.has(account.parentId)) {
      nodes.get(account.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: AccountNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function matchesSearch(node: AccountNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const self = node.code.toLowerCase().includes(q) || node.name.toLowerCase().includes(q) || (node.nameAr ?? "").includes(query);
  return self || node.children.some((c) => matchesSearch(c, query));
}

function AccountRow({
  node,
  depth,
  balances,
  search,
  onEdit,
}: {
  node: AccountNode;
  depth: number;
  balances: Map<string, string>;
  search: string;
  onEdit: (account: Account) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const displayName = i18n.language === "ar" && node.nameAr ? node.nameAr : node.name;
  const balance = balances.get(node.id);

  if (!matchesSearch(node, search)) return null;

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-sunken",
          !node.isActive && "opacity-50",
        )}
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn("flex size-5 items-center justify-center rounded text-subtle", !hasChildren && "invisible")}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}
        </button>

        <span className="w-20 shrink-0 font-mono text-xs text-muted">{node.code}</span>

        <button
          type="button"
          className={cn("flex-1 truncate text-start text-sm", node.isHeader ? "font-semibold text-foreground" : "text-foreground")}
          onClick={() => onEdit(node)}
        >
          {displayName}
        </button>

        {!node.isHeader && (
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {t(`accounting.type_${node.accountType}`)}
          </Badge>
        )}

        {!node.isActive && <Badge variant="warning">{t("accounting.inactive")}</Badge>}

        <span className="w-28 shrink-0 text-end text-sm font-medium tabular-nums text-foreground">
          {!node.isHeader ? formatAmount(balance ?? "0") : ""}
        </span>

        {!node.isHeader && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={() => navigate(`/accounting/reports/general-ledger?accountId=${node.id}`)}
          >
            {t("accounting.viewLedger")}
          </Button>
        )}
      </div>
      {expanded && node.children.map((child) => (
        <AccountRow key={child.id} node={child} depth={depth + 1} balances={balances} search={search} onEdit={onEdit} />
      ))}
    </>
  );
}

export function ChartOfAccountsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);

  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const trialBalanceQuery = useQuery({
    queryKey: ["accounting", "trial-balance"],
    queryFn: () => accountingApi.reports.trialBalance(),
  });

  const balances = React.useMemo(() => {
    const map = new Map<string, string>();
    trialBalanceQuery.data?.rows.forEach((r) => map.set(r.accountId, r.balance));
    return map;
  }, [trialBalanceQuery.data]);

  const tree = React.useMemo(() => buildTree(accountsQuery.data ?? []), [accountsQuery.data]);
  const headerAccounts = React.useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.isHeader).sort((a, b) => a.code.localeCompare(b.code)),
    [accountsQuery.data],
  );

  const canCreate = hasPermission("accounting.chart_of_accounts.create");

  const openCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };
  const openEdit = (account: Account) => {
    if (!hasPermission("accounting.chart_of_accounts.update")) return;
    setEditingAccount(account);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={t("accounting.chartOfAccounts")}
        description={t("accounting.chartOfAccountsDesc")}
        breadcrumbs={[{ label: t("nav.accounting") }, { label: t("accounting.chartOfAccounts") }]}
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("accounting.addAccount")}
            </Button>
          )
        }
      />

      {accountsQuery.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {accountsQuery.error instanceof ApiError && accountsQuery.error.status === 403
            ? t("common.forbiddenBody")
            : t("common.errorGeneric")}
        </Alert>
      ) : (
        <Card>
          <div className="border-b border-border p-3">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("accounting.searchAccounts")}
                className="ps-8"
              />
            </div>
          </div>

          <div className="p-2">
            {accountsQuery.isPending ? (
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <EmptyState icon={ListTree} title={t("common.noData")} />
            ) : (
              tree.map((node) => (
                <AccountRow key={node.id} node={node} depth={0} balances={balances} search={search} onEdit={openEdit} />
              ))
            )}
          </div>
        </Card>
      )}

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        headerAccounts={headerAccounts}
        editingAccount={editingAccount}
      />
    </div>
  );
}
