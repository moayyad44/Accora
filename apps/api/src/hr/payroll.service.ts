import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EmployeeStatus, JournalSourceType, PayrollItemType, PayrollRunStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ContractsService } from "./contracts.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService, PostingLineInput } from "../accounting/journal-entries.service";

export interface AddPayrollItemInput {
  employeeId: string;
  type: PayrollItemType;
  amount: string;
  costCenterId?: string;
  loanId?: string;
  note?: string;
}

/**
 * Payroll run lifecycle: DRAFT (auto-seeded with one BASIC item per active
 * employee's current contract, then freely editable) -> approve() gates it
 * so a second pair of eyes signs off before anything commits -> post()
 * turns every item into one balanced journal entry and reduces any repaid
 * loans' remaining balance (docs/ARCHITECTURE.md §10).
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string, status?: PayrollRunStatus) {
    return tx.payrollRun.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { period: true },
      orderBy: { runDate: "desc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, runId: string) {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: { period: true, items: { include: { employee: true, costCenter: true, loan: true } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }

  async createDraft(tx: Prisma.TransactionClient, companyId: string, periodId: string) {
    const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId, fiscalYear: { companyId } } });
    if (!period) throw new NotFoundException("Fiscal period not found");

    const existing = await tx.payrollRun.findUnique({ where: { companyId_periodId: { companyId, periodId } } });
    if (existing) {
      throw new BadRequestException(`A payroll run already exists for this period (status: ${existing.status})`);
    }

    const run = await tx.payrollRun.create({
      data: { companyId, periodId, runDate: period.endDate, status: PayrollRunStatus.DRAFT },
    });

    const employees = await tx.employee.findMany({ where: { companyId, status: EmployeeStatus.ACTIVE } });
    for (const employee of employees) {
      const contract = await this.contractsService.getCurrentContract(tx, employee.id, period.endDate);
      if (!contract) continue; // no active contract covering this period -> not included, not an error
      await tx.payrollItem.create({
        data: { payrollRunId: run.id, employeeId: employee.id, type: PayrollItemType.BASIC, amount: contract.baseSalary },
      });
    }

    return this.get(tx, companyId, run.id);
  }

  async addItem(tx: Prisma.TransactionClient, companyId: string, runId: string, input: AddPayrollItemInput) {
    const run = await tx.payrollRun.findFirst({ where: { id: runId, companyId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(`Cannot modify a payroll run that is ${run.status.toLowerCase()}`);
    }

    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException("amount must be greater than zero");

    if (input.costCenterId) {
      const costCenter = await tx.costCenter.findFirst({ where: { id: input.costCenterId, companyId } });
      if (!costCenter) throw new NotFoundException("Cost center not found");
    }

    let loanId: string | undefined;
    if (input.type === PayrollItemType.LOAN_REPAYMENT) {
      if (!input.loanId) throw new BadRequestException("loanId is required for a LOAN_REPAYMENT item");
      const loan = await tx.loan.findFirst({ where: { id: input.loanId, employeeId: input.employeeId } });
      if (!loan) throw new NotFoundException("Loan not found for this employee");
      if (amount.gt(new Decimal(loan.remainingBalance.toString()))) {
        throw new BadRequestException(
          `Repayment ${amount.toFixed(4)} exceeds remaining loan balance ${loan.remainingBalance.toFixed(4)}`,
        );
      }
      loanId = input.loanId;
    } else if (input.loanId) {
      throw new BadRequestException("loanId is only valid for a LOAN_REPAYMENT item");
    }

    return tx.payrollItem.create({
      data: {
        payrollRunId: run.id,
        employeeId: input.employeeId,
        type: input.type,
        amount: amount.toFixed(4),
        costCenterId: input.costCenterId,
        loanId,
        note: input.note,
      },
    });
  }

  async removeItem(tx: Prisma.TransactionClient, companyId: string, runId: string, itemId: string) {
    const run = await tx.payrollRun.findFirst({ where: { id: runId, companyId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(`Cannot modify a payroll run that is ${run.status.toLowerCase()}`);
    }
    const item = await tx.payrollItem.findFirst({ where: { id: itemId, payrollRunId: run.id } });
    if (!item) throw new NotFoundException("Payroll item not found");
    await tx.payrollItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async approve(tx: Prisma.TransactionClient, companyId: string, runId: string) {
    const run = await tx.payrollRun.findFirst({ where: { id: runId, companyId }, include: { items: true } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(`Payroll run is already ${run.status.toLowerCase()}`);
    }
    if (run.items.length === 0) throw new BadRequestException("Cannot approve an empty payroll run");
    return tx.payrollRun.update({ where: { id: run.id }, data: { status: PayrollRunStatus.APPROVED } });
  }

  async post(tx: Prisma.TransactionClient, companyId: string, userId: string, runId: string) {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: { items: true, period: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new BadRequestException(`Only an approved payroll run can be posted (this one is ${run.status.toLowerCase()})`);
    }

    // Gross pay (BASIC/ALLOWANCE/OVERTIME) drives the expense side, split by
    // cost center; deductions and loan repayments reduce what's actually
    // owed to the employee without ever touching the expense line itself.
    const expenseByCostCenter = new Map<string | null, Decimal>();
    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalLoanRepayments = new Decimal(0);
    const loanRepaymentsByLoan = new Map<string, Decimal>();

    for (const item of run.items) {
      const amount = new Decimal(item.amount.toString());
      if (item.type === PayrollItemType.DEDUCTION) {
        totalDeductions = totalDeductions.plus(amount);
      } else if (item.type === PayrollItemType.LOAN_REPAYMENT) {
        totalLoanRepayments = totalLoanRepayments.plus(amount);
        loanRepaymentsByLoan.set(item.loanId!, (loanRepaymentsByLoan.get(item.loanId!) ?? new Decimal(0)).plus(amount));
      } else {
        totalGross = totalGross.plus(amount);
        const key = item.costCenterId ?? null;
        expenseByCostCenter.set(key, (expenseByCostCenter.get(key) ?? new Decimal(0)).plus(amount));
      }
    }

    const netPayable = totalGross.minus(totalDeductions).minus(totalLoanRepayments);
    if (netPayable.isNegative()) {
      throw new BadRequestException(
        `Deductions and loan repayments (${totalDeductions.plus(totalLoanRepayments).toFixed(4)}) exceed gross pay (${totalGross.toFixed(4)})`,
      );
    }

    const salaryExpenseAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_SALARY_EXPENSE");
    const lines: PostingLineInput[] = [];
    for (const [costCenterId, amount] of expenseByCostCenter) {
      if (amount.lte(0)) continue;
      lines.push({ accountId: salaryExpenseAccountId, costCenterId: costCenterId ?? undefined, debit: amount.toFixed(4) });
    }
    if (netPayable.gt(0)) {
      const salariesPayableAccountId = await this.accountMappingsService.require(tx, companyId, "DEFAULT_SALARIES_PAYABLE");
      lines.push({ accountId: salariesPayableAccountId, credit: netPayable.toFixed(4) });
    }
    if (totalDeductions.gt(0)) {
      const deductionsPayableAccountId = await this.accountMappingsService.require(
        tx,
        companyId,
        "DEFAULT_PAYROLL_DEDUCTIONS_PAYABLE",
      );
      lines.push({ accountId: deductionsPayableAccountId, credit: totalDeductions.toFixed(4) });
    }
    if (totalLoanRepayments.gt(0)) {
      const loansReceivableAccountId = await this.accountMappingsService.require(
        tx,
        companyId,
        "DEFAULT_EMPLOYEE_LOANS_RECEIVABLE",
      );
      lines.push({ accountId: loansReceivableAccountId, credit: totalLoanRepayments.toFixed(4) });
    }

    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: run.period.endDate,
      description: `Payroll Run — ${run.period.name}`,
      sourceType: JournalSourceType.PAYROLL,
      sourceId: run.id,
      lines,
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    for (const [loanId, amount] of loanRepaymentsByLoan) {
      await tx.loan.update({ where: { id: loanId }, data: { remainingBalance: { decrement: amount.toFixed(4) } } });
    }

    return tx.payrollRun.update({
      where: { id: run.id },
      data: { status: PayrollRunStatus.POSTED, postedJournalEntryId: posted.id, postedAt: new Date() },
      include: { period: true, items: { include: { employee: true, loan: true } } },
    });
  }
}
