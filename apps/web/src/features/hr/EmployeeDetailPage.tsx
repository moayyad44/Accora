import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { hrApi, type EmployeeStatus } from "@/api/hr";
import { accountingApi } from "@/api/accounting";
import { ApiError } from "@/api/client";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";

const STATUS_VARIANT: Record<EmployeeStatus, "success" | "warning" | "error"> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  TERMINATED: "error",
};

const contractSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  baseSalary: z.string().min(1),
  terms: z.string().optional(),
});
type ContractFormValues = z.infer<typeof contractSchema>;

const loanSchema = z.object({
  amount: z.string().min(1),
  installments: z.string().min(1),
  startDate: z.string().min(1),
  fundingAccountId: z.string().min(1),
});
type LoanFormValues = z.infer<typeof loanSchema>;

const attendanceSchema = z.object({
  date: z.string().min(1),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  overtimeHours: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "ON_LEAVE"]),
});
type AttendanceFormValues = z.infer<typeof attendanceSchema>;

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [contractOpen, setContractOpen] = React.useState(false);
  const [loanOpen, setLoanOpen] = React.useState(false);
  const [attendanceOpen, setAttendanceOpen] = React.useState(false);
  const [contractError, setContractError] = React.useState<string | null>(null);
  const [loanError, setLoanError] = React.useState<string | null>(null);
  const [attendanceError, setAttendanceError] = React.useState<string | null>(null);

  const employeeQuery = useQuery({
    queryKey: ["hr", "employees", id],
    queryFn: () => hrApi.employees.get(id!),
    enabled: !!id,
  });
  const contractsQuery = useQuery({
    queryKey: ["hr", "contracts", id],
    queryFn: () => hrApi.contracts.list(id!),
    enabled: !!id,
  });
  const loansQuery = useQuery({
    queryKey: ["hr", "loans", id],
    queryFn: () => hrApi.loans.list(id!),
    enabled: !!id,
  });
  const attendanceQuery = useQuery({
    queryKey: ["hr", "attendance", id],
    queryFn: () => hrApi.attendance.list(id!),
    enabled: !!id,
  });
  const accountsQuery = useQuery({ queryKey: ["accounting", "accounts"], queryFn: accountingApi.accounts.list });
  const postableAccounts = (accountsQuery.data ?? []).filter((a) => !a.isHeader && a.isActive);

  const contractForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: { startDate: new Date().toISOString().slice(0, 10) },
  });
  const loanForm = useForm<LoanFormValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: { startDate: new Date().toISOString().slice(0, 10), installments: "1" },
  });
  const attendanceForm = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), status: "PRESENT" },
  });

  const contractMutation = useMutation({
    mutationFn: (v: ContractFormValues) =>
      hrApi.contracts.create({ employeeId: id!, ...v, endDate: v.endDate || undefined, terms: v.terms || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "contracts", id] });
      toast({ title: t("hr.contractCreated"), variant: "success" });
      setContractOpen(false);
      contractForm.reset({ startDate: new Date().toISOString().slice(0, 10) });
    },
    onError: (err) => setContractError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const loanMutation = useMutation({
    mutationFn: (v: LoanFormValues) =>
      hrApi.loans.grant({ employeeId: id!, amount: v.amount, installments: Number(v.installments), startDate: v.startDate, fundingAccountId: v.fundingAccountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "loans", id] });
      toast({ title: t("hr.loanGranted"), variant: "success" });
      setLoanOpen(false);
      loanForm.reset({ startDate: new Date().toISOString().slice(0, 10), installments: "1" });
    },
    onError: (err) => setLoanError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  const attendanceMutation = useMutation({
    mutationFn: (v: AttendanceFormValues) =>
      hrApi.attendance.record({
        employeeId: id!,
        date: v.date,
        checkIn: v.checkIn ? `${v.date}T${v.checkIn}:00` : undefined,
        checkOut: v.checkOut ? `${v.date}T${v.checkOut}:00` : undefined,
        overtimeHours: v.overtimeHours || undefined,
        status: v.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance", id] });
      toast({ title: t("hr.attendanceRecorded"), variant: "success" });
      setAttendanceOpen(false);
      attendanceForm.reset({ date: new Date().toISOString().slice(0, 10), status: "PRESENT" });
    },
    onError: (err) => setAttendanceError(err instanceof ApiError ? err.message : t("common.errorGeneric")),
  });

  if (employeeQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (employeeQuery.isError) {
    return (
      <Alert variant="error" title={t("common.errorTitle")}>
        {employeeQuery.error instanceof ApiError && employeeQuery.error.status === 403 ? t("common.forbiddenBody") : t("common.errorGeneric")}
      </Alert>
    );
  }

  const employee = employeeQuery.data;

  return (
    <div>
      <PageHeader
        title={`${employee.employeeNumber} — ${employee.fullName}`}
        breadcrumbs={[{ label: t("nav.hr") }, { label: t("hr.employees"), to: "/hr/employees" }, { label: employee.employeeNumber }]}
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">{t("hr.department")}</p>
            <p className="text-sm font-medium text-foreground">{employee.department?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("hr.position")}</p>
            <p className="text-sm font-medium text-foreground">{employee.position?.title ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("hr.hireDate")}</p>
            <p className="text-sm font-medium text-foreground">{formatDate(employee.hireDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("common.status")}</p>
            <Badge variant={STATUS_VARIANT[employee.status]}>{t(`hr.status_${employee.status}`)}</Badge>
          </div>
          {employee.phone && (
            <div>
              <p className="text-xs text-muted">{t("parties.phone")}</p>
              <p className="text-sm font-medium text-foreground">{employee.phone}</p>
            </div>
          )}
          {employee.email && (
            <div>
              <p className="text-xs text-muted">{t("parties.email")}</p>
              <p className="text-sm font-medium text-foreground">{employee.email}</p>
            </div>
          )}
          {employee.nationalId && (
            <div>
              <p className="text-xs text-muted">{t("hr.nationalId")}</p>
              <p className="text-sm font-medium text-foreground">{employee.nationalId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contracts */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("hr.contracts")}</h3>
          {hasPermission("hr.contract.create") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setContractError(null);
                contractForm.reset({ startDate: new Date().toISOString().slice(0, 10) });
                setContractOpen(true);
              }}
            >
              {t("hr.addContract")}
            </Button>
          )}
        </div>
        {(contractsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">{t("hr.noContracts")}</p>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accounting.startDate")}</TableHead>
                  <TableHead>{t("accounting.endDate")}</TableHead>
                  <TableHead className="text-end">{t("hr.baseSalary")}</TableHead>
                  <TableHead>{t("hr.terms")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractsQuery.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.startDate)}</TableCell>
                    <TableCell>{c.endDate ? formatDate(c.endDate) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(c.baseSalary)}</TableCell>
                    <TableCell className="text-muted">{c.terms ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Loans */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("hr.loans")}</h3>
          {hasPermission("hr.loan.create") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoanError(null);
                loanForm.reset({ startDate: new Date().toISOString().slice(0, 10), installments: "1" });
                setLoanOpen(true);
              }}
            >
              {t("hr.grantLoan")}
            </Button>
          )}
        </div>
        {(loansQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">{t("hr.noLoans")}</p>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accounting.startDate")}</TableHead>
                  <TableHead className="text-end">{t("hr.amount")}</TableHead>
                  <TableHead className="text-end">{t("hr.installments")}</TableHead>
                  <TableHead className="text-end">{t("hr.remainingBalance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loansQuery.data?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.startDate)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(l.amount)}</TableCell>
                    <TableCell className="text-end tabular-nums">{l.installments}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums text-foreground">{formatAmount(l.remainingBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Attendance */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("hr.attendance")}</h3>
          {hasPermission("hr.attendance.create") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAttendanceError(null);
                attendanceForm.reset({ date: new Date().toISOString().slice(0, 10), status: "PRESENT" });
                setAttendanceOpen(true);
              }}
            >
              {t("hr.recordAttendance")}
            </Button>
          )}
        </div>
        {(attendanceQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">{t("hr.noAttendance")}</p>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.attendanceDate")}</TableHead>
                  <TableHead>{t("hr.checkIn")}</TableHead>
                  <TableHead>{t("hr.checkOut")}</TableHead>
                  <TableHead className="text-end">{t("hr.overtimeHours")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceQuery.data?.slice(0, 20).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell>{a.checkIn ? formatDateTime(a.checkIn) : "—"}</TableCell>
                    <TableCell>{a.checkOut ? formatDateTime(a.checkOut) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatAmount(a.overtimeHours, 2)}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{t(`hr.attendanceStatus_${a.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Add Contract dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("hr.addContract")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={contractForm.handleSubmit((v) => contractMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {contractError && <Alert variant="error">{contractError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("accounting.startDate")} htmlFor="c-startDate" error={contractForm.formState.errors.startDate?.message}>
                  <Input id="c-startDate" type="date" {...contractForm.register("startDate")} />
                </FormField>
                <FormField label={t("accounting.endDate")} htmlFor="c-endDate">
                  <Input id="c-endDate" type="date" {...contractForm.register("endDate")} />
                </FormField>
              </div>
              <FormField label={t("hr.baseSalary")} htmlFor="c-baseSalary" error={contractForm.formState.errors.baseSalary?.message}>
                <Input id="c-baseSalary" inputMode="decimal" placeholder="0.00" {...contractForm.register("baseSalary")} />
              </FormField>
              <FormField label={t("hr.terms")} htmlFor="c-terms">
                <Input id="c-terms" {...contractForm.register("terms")} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={contractMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Grant Loan dialog */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("hr.grantLoan")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={loanForm.handleSubmit((v) => loanMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {loanError && <Alert variant="error">{loanError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.amount")} htmlFor="l-amount" error={loanForm.formState.errors.amount?.message}>
                  <Input id="l-amount" inputMode="decimal" placeholder="0.00" {...loanForm.register("amount")} />
                </FormField>
                <FormField label={t("hr.installments")} htmlFor="l-installments" error={loanForm.formState.errors.installments?.message}>
                  <Input id="l-installments" inputMode="numeric" {...loanForm.register("installments")} />
                </FormField>
              </div>
              <FormField label={t("accounting.startDate")} htmlFor="l-startDate" error={loanForm.formState.errors.startDate?.message}>
                <Input id="l-startDate" type="date" {...loanForm.register("startDate")} />
              </FormField>
              <FormField
                label={t("fixedAssets.fundingAccount")}
                htmlFor="l-fundingAccountId"
                error={loanForm.formState.errors.fundingAccountId?.message}
              >
                <Controller
                  control={loanForm.control}
                  name="fundingAccountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="l-fundingAccountId">
                        <SelectValue placeholder={t("fixedAssets.fundingAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {postableAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoanOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={loanMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Attendance dialog */}
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("hr.recordAttendance")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={attendanceForm.handleSubmit((v) => attendanceMutation.mutate(v))}>
            <DialogBody className="flex flex-col gap-4">
              {attendanceError && <Alert variant="error">{attendanceError}</Alert>}
              <FormField label={t("hr.attendanceDate")} htmlFor="a-date" error={attendanceForm.formState.errors.date?.message}>
                <Input id="a-date" type="date" {...attendanceForm.register("date")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.checkIn")} htmlFor="a-checkIn">
                  <Input id="a-checkIn" type="time" {...attendanceForm.register("checkIn")} />
                </FormField>
                <FormField label={t("hr.checkOut")} htmlFor="a-checkOut">
                  <Input id="a-checkOut" type="time" {...attendanceForm.register("checkOut")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("hr.overtimeHours")} htmlFor="a-overtimeHours">
                  <Input id="a-overtimeHours" inputMode="decimal" placeholder="0" {...attendanceForm.register("overtimeHours")} />
                </FormField>
                <FormField label={t("common.status")} htmlFor="a-status">
                  <Controller
                    control={attendanceForm.control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="a-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRESENT">{t("hr.attendanceStatus_PRESENT")}</SelectItem>
                          <SelectItem value="ABSENT">{t("hr.attendanceStatus_ABSENT")}</SelectItem>
                          <SelectItem value="LATE">{t("hr.attendanceStatus_LATE")}</SelectItem>
                          <SelectItem value="ON_LEAVE">{t("hr.attendanceStatus_ON_LEAVE")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAttendanceOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={attendanceMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
