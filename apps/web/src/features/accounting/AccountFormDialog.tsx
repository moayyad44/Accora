import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { accountingApi, type Account, type AccountType } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { useState } from "react";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  accountType: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  parentId: z.string().optional(),
  isHeader: z.boolean(),
});
type CreateFormValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  isActive: z.boolean(),
});
type EditFormValues = z.infer<typeof editSchema>;

export function AccountFormDialog({
  open,
  onOpenChange,
  headerAccounts,
  editingAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerAccounts: Account[];
  editingAccount: Account | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!editingAccount;

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { accountType: "ASSET", normalBalance: "DEBIT", isHeader: false },
  });
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: editingAccount
      ? { name: editingAccount.name, nameAr: editingAccount.nameAr ?? "", isActive: editingAccount.isActive }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: accountingApi.accounts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      toast({ title: t("accounting.accountCreated"), variant: "success" });
      onOpenChange(false);
      createForm.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditFormValues) => accountingApi.accounts.update(editingAccount!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      toast({ title: t("accounting.accountUpdated"), variant: "success" });
      onOpenChange(false);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const handleOpenChange = (next: boolean) => {
    setServerError(null);
    if (!next) {
      createForm.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("accounting.editAccount") : t("accounting.addAccount")}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="flex gap-2 text-sm">
                <span className="font-mono text-muted">{editingAccount?.code}</span>
                <span className="text-subtle">
                  {editingAccount && t(`accounting.type_${editingAccount.accountType}`)}
                </span>
              </div>
              <FormField label={t("accounting.nameEn")} htmlFor="edit-name" error={editForm.formState.errors.name?.message}>
                <Input id="edit-name" {...editForm.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="edit-nameAr">
                <Input id="edit-nameAr" dir="rtl" {...editForm.register("nameAr")} />
              </FormField>
              <Controller
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    {t("accounting.active")}
                  </label>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.code")} htmlFor="code" error={createForm.formState.errors.code?.message}>
                  <Input id="code" {...createForm.register("code")} />
                </FormField>
                <FormField label={t("accounting.accountType")} htmlFor="accountType">
                  <Controller
                    control={createForm.control}
                    name="accountType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="accountType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {t(`accounting.type_${type}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>

              <FormField label={t("accounting.nameEn")} htmlFor="name" error={createForm.formState.errors.name?.message}>
                <Input id="name" {...createForm.register("name")} />
              </FormField>
              <FormField label={t("accounting.nameAr")} htmlFor="nameAr">
                <Input id="nameAr" dir="rtl" {...createForm.register("nameAr")} />
              </FormField>

              <FormField label={t("accounting.normalBalance")} htmlFor="normalBalance">
                <Controller
                  control={createForm.control}
                  name="normalBalance"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="normalBalance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEBIT">{t("accounting.balance_DEBIT")}</SelectItem>
                        <SelectItem value="CREDIT">{t("accounting.balance_CREDIT")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label={t("accounting.parentAccount")} htmlFor="parentId">
                <Controller
                  control={createForm.control}
                  name="parentId"
                  render={({ field }) => (
                    <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                      <SelectTrigger id="parentId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("accounting.noParent")}</SelectItem>
                        {headerAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <Controller
                control={createForm.control}
                name="isHeader"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    {t("accounting.isHeaderAccount")}
                  </label>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
