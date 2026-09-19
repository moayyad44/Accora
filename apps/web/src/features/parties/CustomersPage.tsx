import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { partiesApi, type Customer } from "@/api/parties";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CustomersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["parties", "customers"], queryFn: partiesApi.customers.list });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: partiesApi.customers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties", "customers"] });
      toast({ title: t("parties.customerCreated"), variant: "success" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<Customer>[] = [
    { accessorKey: "code", header: t("parties.code"), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: "name", header: t("parties.name") },
    { accessorKey: "phone", header: t("parties.phone"), cell: (c) => c.getValue<string>() || "—" },
    { accessorKey: "email", header: t("parties.email"), cell: (c) => c.getValue<string>() || "—" },
  ];

  return (
    <div>
      <PageHeader
        title={t("parties.customers")}
        description={t("parties.customersDesc")}
        breadcrumbs={[{ label: t("nav.sales") }, { label: t("parties.customers") }]}
        actions={
          hasPermission("sales.customer.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                form.reset();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("parties.addCustomer")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("parties.searchParties")} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("parties.addCustomer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate({ ...v, email: v.email || undefined }))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("parties.code")} htmlFor="cust-code" error={form.formState.errors.code?.message}>
                  <Input id="cust-code" {...form.register("code")} />
                </FormField>
                <FormField label={t("parties.phone")} htmlFor="cust-phone">
                  <Input id="cust-phone" {...form.register("phone")} />
                </FormField>
              </div>
              <FormField label={t("parties.name")} htmlFor="cust-name" error={form.formState.errors.name?.message}>
                <Input id="cust-name" {...form.register("name")} />
              </FormField>
              <FormField label={t("parties.nameAr")} htmlFor="cust-nameAr">
                <Input id="cust-nameAr" dir="rtl" {...form.register("nameAr")} />
              </FormField>
              <FormField label={t("parties.email")} htmlFor="cust-email" error={form.formState.errors.email?.message}>
                <Input id="cust-email" type="email" {...form.register("email")} />
              </FormField>
              <FormField label={t("parties.address")} htmlFor="cust-address">
                <Input id="cust-address" {...form.register("address")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
