import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 10b acceptance tests — banks & cash: cash/bank accounts, receipt
 * and payment vouchers (including clearing a customer's AR / supplier's
 * AP), transfers between accounts, and reconciliation. Exercised through
 * real HTTP against real PostgreSQL, same standard as every other phase.
 */
describe("Banking: cash/bank accounts, vouchers, transfers, reconciliation (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `bank.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let customerId: string;
  let supplierId: string;
  const thisYear = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({ companyName: "Banking Test Co", baseCurrencyCode: "JOD", adminFullName: "Bank Admin", adminEmail, adminPassword: password })
      .expect(201);
    token = reg.body.accessToken;

    await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);

    const accts = await request(app.getHttpServer()).get("/accounting/accounts").set("Authorization", `Bearer ${token}`).expect(200);
    const cashGlAccountId = accts.body.find((a: any) => a.code === "1111").id; // Cash on Hand
    const bankGlAccountId = accts.body.find((a: any) => a.code === "1121").id; // Bank Current Account

    const cashAccount = await request(app.getHttpServer())
      .post("/banking/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Main Cash Box", type: "CASH", accountId: cashGlAccountId })
      .expect(201);
    cashAccountId = cashAccount.body.id;

    const bankAccount = await request(app.getHttpServer())
      .post("/banking/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bank of Jordan - JOD", type: "BANK", accountId: bankGlAccountId, bankName: "Bank of Jordan", iban: "JO12345" })
      .expect(201);
    bankAccountId = bankAccount.body.id;

    const customer = await request(app.getHttpServer())
      .post("/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "CUST-1", name: "Customer" })
      .expect(201);
    customerId = customer.body.id;

    const supplier = await request(app.getHttpServer())
      .post("/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SUP-1", name: "Supplier" })
      .expect(201);
    supplierId = supplier.body.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("creates cash and bank accounts and rejects a duplicate name", async () => {
    const list = await request(app.getHttpServer()).get("/banking/accounts").set("Authorization", `Bearer ${token}`).expect(200);
    expect(list.body.some((a: any) => a.id === cashAccountId)).toBe(true);
    expect(list.body.some((a: any) => a.id === bankAccountId)).toBe(true);

    const dup = await request(app.getHttpServer())
      .post("/banking/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Main Cash Box", type: "CASH", accountId: list.body[0].accountId })
      .expect(400);
    expect(dup.body.message).toMatch(/already exists/);
  });

  it("receipt voucher against a customer clears their AR, and balance reflects it", async () => {
    const before = await request(app.getHttpServer())
      .get(`/banking/accounts/${cashAccountId}/balance`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(before.body.balance).toBe("0.0000");

    const draft = await request(app.getHttpServer())
      .post("/banking/receipt-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, voucherDate: today, partyType: "CUSTOMER", customerId, amount: "500.00", description: "Advance payment" })
      .expect(201);
    expect(draft.body.voucherNumber).toMatch(/^RV-/);
    expect(draft.body.status).toBe("DRAFT");

    const posted = await request(app.getHttpServer())
      .post(`/banking/receipt-vouchers/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const cashLine = je.lines.find((l) => l.account.code === "1111");
    const arLine = je.lines.find((l) => l.account.code === "1131");
    expect(cashLine?.debit.toFixed(4)).toBe("500.0000");
    expect(arLine?.credit.toFixed(4)).toBe("500.0000");

    const after = await request(app.getHttpServer())
      .get(`/banking/accounts/${cashAccountId}/balance`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(after.body.balance).toBe("500.0000");

    // Can't post the same voucher twice.
    const rePost = await request(app.getHttpServer())
      .post(`/banking/receipt-vouchers/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(rePost.body.message).toMatch(/already posted/);
  });

  it("payment voucher against a supplier clears their AP", async () => {
    const draft = await request(app.getHttpServer())
      .post("/banking/payment-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: bankAccountId, voucherDate: today, partyType: "SUPPLIER", supplierId, amount: "300.00" })
      .expect(201);
    expect(draft.body.voucherNumber).toMatch(/^PV-/);

    const posted = await request(app.getHttpServer())
      .post(`/banking/payment-vouchers/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const apLine = je.lines.find((l) => l.account.code === "2111");
    const bankLine = je.lines.find((l) => l.account.code === "1121");
    expect(apLine?.debit.toFixed(4)).toBe("300.0000");
    expect(bankLine?.credit.toFixed(4)).toBe("300.0000");
  });

  it("payment voucher with partyType OTHER requires and debits otherAccountId (e.g. an expense paid from cash)", async () => {
    const accts = await request(app.getHttpServer()).get("/accounting/accounts").set("Authorization", `Bearer ${token}`).expect(200);
    const rentExpenseAccountId = accts.body.find((a: any) => a.code === "5420").id;

    const missingAccount = await request(app.getHttpServer())
      .post("/banking/payment-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, voucherDate: today, partyType: "OTHER", amount: "50.00" })
      .expect(400);
    expect(missingAccount.body.message).toMatch(/otherAccountId is required/);

    const draft = await request(app.getHttpServer())
      .post("/banking/payment-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, voucherDate: today, partyType: "OTHER", otherAccountId: rentExpenseAccountId, amount: "50.00", description: "Office rent" })
      .expect(201);
    const posted = await request(app.getHttpServer())
      .post(`/banking/payment-vouchers/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const rentLine = je.lines.find((l) => l.account.code === "5420");
    expect(rentLine?.debit.toFixed(4)).toBe("50.0000");
  });

  it("bank transfer moves money between accounts and rejects transferring to itself", async () => {
    const sameAccount = await request(app.getHttpServer())
      .post("/banking/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fromAccountId: cashAccountId, toAccountId: cashAccountId, transferDate: today, amount: "100.00" })
      .expect(400);
    expect(sameAccount.body.message).toMatch(/must be different/);

    const draft = await request(app.getHttpServer())
      .post("/banking/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fromAccountId: cashAccountId, toAccountId: bankAccountId, transferDate: today, amount: "200.00", description: "Deposit cash to bank" })
      .expect(201);
    expect(draft.body.transferNumber).toMatch(/^BT-/);

    const posted = await request(app.getHttpServer())
      .post(`/banking/transfers/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const cashLine = je.lines.find((l) => l.account.code === "1111");
    const bankLine = je.lines.find((l) => l.account.code === "1121");
    expect(cashLine?.credit.toFixed(4)).toBe("200.0000");
    expect(bankLine?.debit.toFixed(4)).toBe("200.0000");
  });

  it("reconciliation computes the difference against a statement balance and marks items cleared", async () => {
    // Cash box currently has: +500 receipt (test 2) -50 OTHER payment (test 4)
    // -200 transfer out (test 5) = 250.0000 book balance.
    const run = await request(app.getHttpServer())
      .post("/banking/reconciliations")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, statementDate: today, statementBalance: "230.00" })
      .expect(201);
    // Prisma Decimal JSON-serializes via toString(), dropping trailing zeros.
    expect(run.body.bookBalance).toBe("250");
    expect(run.body.difference).toBe("-20"); // statement is 20 short of the books

    const unreconciled = await request(app.getHttpServer())
      .get(`/banking/reconciliations/unreconciled?cashBankAccountId=${cashAccountId}&asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(unreconciled.body.receipts.length).toBeGreaterThanOrEqual(1);
    expect(unreconciled.body.transfersOut.length).toBeGreaterThanOrEqual(1);

    const receiptId = unreconciled.body.receipts[0].id;
    await request(app.getHttpServer())
      .post("/banking/reconciliations/mark-reconciled")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiptVoucherIds: [receiptId] })
      .expect(201);

    const afterMark = await request(app.getHttpServer())
      .get(`/banking/reconciliations/unreconciled?cashBankAccountId=${cashAccountId}&asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(afterMark.body.receipts.find((r: any) => r.id === receiptId)).toBeUndefined();
  });
});
