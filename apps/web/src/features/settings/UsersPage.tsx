import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { settingsApi, type CompanyUser } from "@/api/settings";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string().min(1),
});
type CreateFormValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  roleId: z.string().min(1),
  isActive: z.boolean(),
});
type EditFormValues = z.infer<typeof editSchema>;

export function UsersPage() {
  const { t } = useTranslation();
  const { hasPermission, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<CompanyUser | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({ queryKey: ["settings", "users"], queryFn: settingsApi.users.list });
  const rolesQuery = useQuery({ queryKey: ["settings", "roles"], queryFn: settingsApi.roles.list });

  const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  const createMutation = useMutation({
    mutationFn: settingsApi.users.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      toast({ title: t("settings.userCreated"), variant: "success" });
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditFormValues) => settingsApi.users.update(editingUser!.userId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      toast({ title: t("settings.userUpdated"), variant: "success" });
      setEditingUser(null);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<CompanyUser>[] = [
    { accessorKey: "fullName", header: t("settings.fullName") },
    { accessorKey: "email", header: t("settings.email") },
    { accessorKey: "roleName", header: t("settings.role") },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "neutral"}>
          {row.original.isActive ? t("accounting.active") : t("accounting.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        hasPermission("core.user.update") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setServerError(null);
              editForm.reset({ roleId: row.original.roleId, isActive: row.original.isActive });
              setEditingUser(row.original);
            }}
          >
            <Pencil className="size-4" />
            {t("common.edit")}
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav.users")}
        description={t("settings.usersDesc")}
        breadcrumbs={[{ label: t("nav.settings") }, { label: t("nav.users") }]}
        actions={
          hasPermission("core.user.create") && (
            <Button
              onClick={() => {
                setServerError(null);
                createForm.reset();
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("settings.addUser")}
            </Button>
          )
        }
      />

      {query.isError ? (
        <Alert variant="error" title={t("common.errorTitle")}>
          {query.error instanceof ApiError && query.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
        </Alert>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isPending} searchPlaceholder={t("common.search")} />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("settings.addUser")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("settings.fullName")} htmlFor="user-fullName" error={createForm.formState.errors.fullName?.message}>
                <Input id="user-fullName" {...createForm.register("fullName")} />
              </FormField>
              <FormField label={t("settings.email")} htmlFor="user-email" error={createForm.formState.errors.email?.message}>
                <Input id="user-email" type="email" {...createForm.register("email")} />
              </FormField>
              <FormField
                label={t("settings.password")}
                htmlFor="user-password"
                hint={t("settings.passwordHint")}
                error={createForm.formState.errors.password?.message}
              >
                <Input id="user-password" type="password" {...createForm.register("password")} />
              </FormField>
              <FormField label={t("settings.role")} htmlFor="user-roleId" error={createForm.formState.errors.roleId?.message}>
                <Controller
                  control={createForm.control}
                  name="roleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="user-roleId">
                        <SelectValue placeholder={t("settings.role")} />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesQuery.data?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{editingUser?.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <FormField label={t("settings.role")} htmlFor="edit-user-roleId">
                <Controller
                  control={editForm.control}
                  name="roleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-user-roleId">
                        <SelectValue placeholder={t("settings.role")} />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesQuery.data?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label={t("common.status")} htmlFor="edit-user-isActive">
                <Controller
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) =>
                    editingUser?.userId === currentUser?.id ? (
                      <p className="text-sm text-subtle">{t("settings.cannotDeactivateSelf")}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Switch id="edit-user-isActive" checked={field.value} onCheckedChange={field.onChange} />
                        <span className="text-sm">{field.value ? t("accounting.active") : t("accounting.inactive")}</span>
                      </div>
                    )
                  }
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
