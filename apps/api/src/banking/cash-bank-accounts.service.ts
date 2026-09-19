import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashBankAccountType, JournalEntryStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { AccountsService } from "../accounting/accounts.service";

// A reversed entry's own lines must still count (they're what the
// reversal entry nets against to reach zero) — same principle documented
// in ReportsService.LEDGER_STATUSES.
const LEDGER_STATUSES = [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED];

export interface CreateCashBankAccountInput {
  name: string;
  nameAr?: string;
  type: CashBankAccountType;
  accountId: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
}

@Injectable()
export class CashBankAccountsService {
  constructor(private readonly accountsService: AccountsService) {}

  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.cashBankAccount.findMany({ where: { companyId }, include: { account: true }, orderBy: { name: "asc" } });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const account = await tx.cashBankAccount.findFirst({ where: { id, companyId }, include: { account: true } });
    if (!account) throw new NotFoundException("Cash/bank account not found");
    return account;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateCashBankAccountInput) {
    const existing = await tx.cashBankAccount.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new BadRequestException(`Cash/bank account "${input.name}" already exists`);

    await this.accountsService.requirePostable(tx, companyId, input.accountId);

    return tx.cashBankAccount.create({
      data: {
        companyId,
        name: input.name,
        nameAr: input.nameAr,
        type: input.type,
        accountId: input.accountId,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        iban: input.iban,
      },
      include: { account: true },
    });
  }

  /** Current book balance of the linked GL account — what every posted
   * receipt/payment/transfer against this cash/bank account has netted to
   * so far. Used by reconciliation, and generally useful on its own. */
  async currentBalance(tx: Prisma.TransactionClient, companyId: string, id: string): Promise<Decimal> {
    const cashBankAccount = await this.get(tx, companyId, id);
    const lines = await tx.journalEntryLine.findMany({
      where: { accountId: cashBankAccount.accountId, journalEntry: { companyId, status: { in: LEDGER_STATUSES } } },
    });
    let balance = new Decimal(0);
    for (const line of lines) {
      balance = balance.plus(line.debit.toString()).minus(line.credit.toString());
    }
    return balance;
  }
}
