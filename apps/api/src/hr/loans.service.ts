import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JournalSourceType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";
import { AccountMappingsService } from "../accounting/account-mappings.service";
import { JournalEntriesService } from "../accounting/journal-entries.service";

export interface GrantLoanInput {
  employeeId: string;
  amount: string;
  installments: number;
  startDate: Date;
  /** Where the loan money actually came from — cash or bank. */
  fundingAccountId: string;
}

/**
 * A loan the company advances an employee, repaid over payroll runs
 * (docs/ARCHITECTURE.md §10). Granting one is a real cash outflow, so it
 * posts immediately: DR Employee Loans Receivable (an asset — the company
 * is owed this back) / CR wherever it was paid from. Repayments happen
 * later as PayrollItem(type=LOAN_REPAYMENT) rows during a payroll run,
 * which reduce remainingBalance and the same receivable account.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountMappingsService: AccountMappingsService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async list(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");
    return tx.loan.findMany({ where: { employeeId }, orderBy: { startDate: "desc" } });
  }

  async grant(tx: Prisma.TransactionClient, companyId: string, userId: string, input: GrantLoanInput) {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new NotFoundException("Employee not found");

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException("amount must be greater than zero");
    if (!Number.isInteger(input.installments) || input.installments <= 0) {
      throw new BadRequestException("installments must be a positive integer");
    }
    await this.accountsService.requirePostable(tx, companyId, input.fundingAccountId);

    const loan = await tx.loan.create({
      data: {
        employeeId: input.employeeId,
        amount: amount.toFixed(4),
        installments: input.installments,
        remainingBalance: amount.toFixed(4),
        startDate: input.startDate,
      },
    });

    const receivableAccountId = await this.accountMappingsService.require(
      tx,
      companyId,
      "DEFAULT_EMPLOYEE_LOANS_RECEIVABLE",
    );
    const entry = await this.journalEntriesService.createDraft(tx, companyId, userId, {
      entryDate: input.startDate,
      description: `Employee Loan — ${employee.fullName}`,
      sourceType: JournalSourceType.EMPLOYEE_LOAN,
      sourceId: loan.id,
      lines: [
        { accountId: receivableAccountId, debit: amount.toFixed(4) },
        { accountId: input.fundingAccountId, credit: amount.toFixed(4) },
      ],
    });
    const posted = await this.journalEntriesService.post(tx, companyId, userId, entry.id);

    return tx.loan.update({ where: { id: loan.id }, data: { postedJournalEntryId: posted.id } });
  }
}
