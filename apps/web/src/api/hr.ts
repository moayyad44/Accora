import { api } from "./client";
import type { CostCenter, FiscalPeriod } from "./accounting";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
}

export interface CreateDepartmentInput {
  name: string;
  nameAr?: string;
  parentId?: string;
}

export interface Position {
  id: string;
  companyId: string;
  departmentId: string | null;
  department: Department | null;
  title: string;
  titleAr: string | null;
}

export interface CreatePositionInput {
  title: string;
  titleAr?: string;
  departmentId?: string;
}

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";

export interface Employee {
  id: string;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  department: Department | null;
  positionId: string | null;
  position: Position | null;
  employeeNumber: string;
  fullName: string;
  fullNameAr: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string;
  terminationDate: string | null;
  status: EmployeeStatus;
  createdAt: string;
  contracts?: Contract[];
  loans?: Loan[];
}

export interface CreateEmployeeInput {
  fullName: string;
  fullNameAr?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  hireDate: string;
  departmentId?: string;
  positionId?: string;
}

export interface Contract {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string | null;
  baseSalary: string;
  terms: string | null;
  createdAt: string;
}

export interface CreateContractInput {
  employeeId: string;
  startDate: string;
  endDate?: string;
  baseSalary: string;
  terms?: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "ON_LEAVE";

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  overtimeHours: string;
  status: AttendanceStatus;
}

export interface RecordAttendanceInput {
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  overtimeHours?: string;
  status?: AttendanceStatus;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Leave {
  id: string;
  employeeId: string;
  employee: Employee;
  type: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
}

export interface RequestLeaveInput {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
}

export interface Loan {
  id: string;
  employeeId: string;
  amount: string;
  installments: number;
  remainingBalance: string;
  startDate: string;
  postedJournalEntryId: string | null;
  createdAt: string;
}

export interface GrantLoanInput {
  employeeId: string;
  amount: string;
  installments: number;
  startDate: string;
  fundingAccountId: string;
}

export type PayrollRunStatus = "DRAFT" | "APPROVED" | "POSTED";
export type PayrollItemType = "BASIC" | "ALLOWANCE" | "DEDUCTION" | "OVERTIME" | "LOAN_REPAYMENT";

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employee: Employee;
  type: PayrollItemType;
  amount: string;
  costCenterId: string | null;
  costCenter: CostCenter | null;
  loanId: string | null;
  loan: Loan | null;
  note: string | null;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  periodId: string;
  period: FiscalPeriod;
  runDate: string;
  status: PayrollRunStatus;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  items: PayrollItem[];
}

export interface AddPayrollItemInput {
  employeeId: string;
  type: PayrollItemType;
  amount: string;
  costCenterId?: string;
  loanId?: string;
  note?: string;
}

export const hrApi = {
  departments: {
    list: () => api.get<Department[]>("/hr/departments"),
    create: (input: CreateDepartmentInput) => api.post<Department>("/hr/departments", input),
  },
  positions: {
    list: () => api.get<Position[]>("/hr/positions"),
    create: (input: CreatePositionInput) => api.post<Position>("/hr/positions", input),
  },
  employees: {
    list: (status?: EmployeeStatus) => api.get<Employee[]>(`/hr/employees${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<Employee>(`/hr/employees/${id}`),
    create: (input: CreateEmployeeInput) => api.post<Employee>("/hr/employees", input),
  },
  contracts: {
    list: (employeeId: string) => api.get<Contract[]>(`/hr/contracts?employeeId=${employeeId}`),
    create: (input: CreateContractInput) => api.post<Contract>("/hr/contracts", input),
  },
  attendance: {
    list: (employeeId: string) => api.get<Attendance[]>(`/hr/attendance?employeeId=${employeeId}`),
    record: (input: RecordAttendanceInput) => api.post<Attendance>("/hr/attendance", input),
  },
  leaves: {
    list: (employeeId?: string) => api.get<Leave[]>(`/hr/leaves${employeeId ? `?employeeId=${employeeId}` : ""}`),
    request: (input: RequestLeaveInput) => api.post<Leave>("/hr/leaves", input),
    setStatus: (id: string, status: "APPROVED" | "REJECTED") => api.patch<Leave>(`/hr/leaves/${id}/status`, { status }),
  },
  loans: {
    list: (employeeId: string) => api.get<Loan[]>(`/hr/loans?employeeId=${employeeId}`),
    grant: (input: GrantLoanInput) => api.post<Loan>("/hr/loans", input),
  },
  payrollRuns: {
    list: (status?: PayrollRunStatus) => api.get<PayrollRun[]>(`/hr/payroll-runs${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<PayrollRun>(`/hr/payroll-runs/${id}`),
    createDraft: (periodId: string) => api.post<PayrollRun>("/hr/payroll-runs", { periodId }),
    addItem: (runId: string, input: AddPayrollItemInput) => api.post<PayrollItem>(`/hr/payroll-runs/${runId}/items`, input),
    removeItem: (runId: string, itemId: string) => api.delete<{ deleted: boolean }>(`/hr/payroll-runs/${runId}/items/${itemId}`),
    approve: (id: string) => api.post<PayrollRun>(`/hr/payroll-runs/${id}/approve`),
    post: (id: string) => api.post<PayrollRun>(`/hr/payroll-runs/${id}/post`),
  },
};
