import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { hrApi, type Employee, type EmployeeStatus } from "@/api/hr";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<EmployeeStatus, "success" | "warning" | "error"> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  TERMINATED: "error",
};

const schema = z.object({
  fullName: z.string().min(1),
  fullNameAr: z.string().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  hireDate: z.string().min(1),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function EmployeesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["hr", "employees", status],
    queryFn: () => hrApi.employees.list(status === "all" ? undefined : (status as EmployeeStatus)),
  });
  const departmentsQuery = useQuery({ queryKey: ["hr", "departments"], queryFn: hrApi.departments.list });
  const positionsQuery = useQuery({ queryKey: ["hr", "positions"], queryFn: hrApi.positions.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { hireDate: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (v: FormValues) => hrApi.employees.create({ ...v, email: v.email || undefined }),
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "employees"] });
      toast({ title: t("hr.employeeCreated"), variant: "success" });
      setDialogOpen(false);
      navigate(`/hr/employees/${employee.id}`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const columns: ColumnDef<Employee>[] = [
    { accessorKey: "employeeNumber", header: t("hr.employeeNumber") },
    { accessorKey: "fullName", header: t("hr.fullName") },
    { id: "department", header: t("hr.department"), cell: ({ row }) => row.original.department?.name ?? "—" },
    { id: "position", header: t("hr.position"), cell: ({ row }) => row.original.position?.title ?? "—" },
    { id: "hireDate", header: t("hr.hireDate"), cell: ({ row }) => formatDate(row.original.hireDate) },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`hr.status_${row.original.status}`)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("hr.employees")}
        description={t("hr.employeesDesc")}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.employees") }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("manufacturing.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("hr.status_ACTIVE")}</SelectItem>
                <SelectItem value="ON_LEAVE">{t("hr.status_ON_LEAVE")}</SelectItem>
                <SelectItem value="TERMINATED">{t("hr.status_TERMINATED")}</SelectItem>
              </SelectContent>
            </Select>
            {hasPermission("hr.employee.create") && (
              <Button
                onClick={() => {
                  setServerError(null);
                  form.reset({ hireDate: new Date().toISOString().slice(0, 10) });
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                {t("hr.addEmployee")}
              </Button>
            )}
          </div>
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
          onRowClick={(row) => navigate(`/hr/employees/${row.id}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("hr.addEmployee")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {serverError && <Alert variant="error">{serverError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.fullName")} htmlFor="emp-fullName" error={form.formState.errors.fullName?.message}>
                  <Input id="emp-fullName" {...form.register("fullName")} />
                </FormField>
                <FormField label={t("accounting.nameAr")} htmlFor="emp-fullNameAr">
                  <Input id="emp-fullNameAr" dir="rtl" {...form.register("fullNameAr")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.nationalId")} htmlFor="emp-nationalId">
                  <Input id="emp-nationalId" {...form.register("nationalId")} />
                </FormField>
                <FormField label={t("parties.phone")} htmlFor="emp-phone">
                  <Input id="emp-phone" {...form.register("phone")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("parties.email")} htmlFor="emp-email" error={form.formState.errors.email?.message}>
                  <Input id="emp-email" type="email" {...form.register("email")} />
                </FormField>
                <FormField label={t("hr.hireDate")} htmlFor="emp-hireDate" error={form.formState.errors.hireDate?.message}>
                  <Input id="emp-hireDate" type="date" {...form.register("hireDate")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.department")} htmlFor="emp-departmentId">
                  <Controller
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                        <SelectTrigger id="emp-departmentId">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("hr.noDepartment")}</SelectItem>
                          {departmentsQuery.data?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label={t("hr.position")} htmlFor="emp-positionId">
                  <Controller
                    control={form.control}
                    name="positionId"
                    render={({ field }) => (
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                        <SelectTrigger id="emp-positionId">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {positionsQuery.data?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
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
