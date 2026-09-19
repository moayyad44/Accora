import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 9 acceptance tests — HR & Payroll: departments/positions,
 * employees/contracts, attendance, leave requests, employee loans (GL
 * posting), and the full payroll run lifecycle (draft -> approve -> post)
 * with its accounting effect. All exercised through real HTTP against
 * real PostgreSQL, same standard as every other phase.
 */
describe("HR & Payroll (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `hr.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  const thisYear = new Date().getUTCFullYear();
  const accounts: Record<string, string> = {};
  let periods: Record<string, string> = {};

  /**
   * Registers a brand new company (its own fiscal year + accounts +
   * periods) and returns its token/lookup maps. Payroll draft generation
   * scoops up EVERY active employee's current contract for the target
   * period — by design, not a bug — so any test that asserts an exact
   * gross-pay total needs a company with no other employees in it, rather
   * than sharing the outer suite's company where earlier tests' employees
   * would otherwise leak into the same payroll run.
   */
  async function registerCompany(name: string) {
    const email = `${name.replace(/\s+/g, ".").toLowerCase()}.${unique}@accora.test`;
    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({ companyName: name, baseCurrencyCode: "JOD", adminFullName: "Admin", adminEmail: email, adminPassword: password })
      .expect(201);
    const t = reg.body.accessToken;

    const fy = await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${t}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);
    const p: Record<string, string> = {};
    for (const period of fy.body.periods) p[period.name] = period.id;

    const accts = await request(app.getHttpServer()).get("/accounting/accounts").set("Authorization", `Bearer ${t}`).expect(200);
    const a: Record<string, string> = {};
    for (const acc of accts.body) a[acc.code] = acc.id;

    return { token: t, accounts: a, periods: p };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const co = await registerCompany("HR Test Co");
    token = co.token;
    Object.assign(accounts, co.accounts);
    periods = co.periods;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  async function createEmployeeWithContract(baseSalary: string, useToken: string = token) {
    const dept = await request(app.getHttpServer())
      .post("/hr/departments")
      .set("Authorization", `Bearer ${useToken}`)
      .send({ name: `Dept-${unique}-${Math.random()}` })
      .expect(201);
    const pos = await request(app.getHttpServer())
      .post("/hr/positions")
      .set("Authorization", `Bearer ${useToken}`)
      .send({ title: `Position-${unique}-${Math.random()}`, departmentId: dept.body.id })
      .expect(201);
    const emp = await request(app.getHttpServer())
      .post("/hr/employees")
      .set("Authorization", `Bearer ${useToken}`)
      .send({ fullName: "Test Employee", hireDate: `${thisYear}-01-01`, departmentId: dept.body.id, positionId: pos.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post("/hr/contracts")
      .set("Authorization", `Bearer ${useToken}`)
      .send({ employeeId: emp.body.id, startDate: `${thisYear}-01-01`, baseSalary })
      .expect(201);
    return emp.body;
  }

  it("creates departments, positions, and an employee with an auto-generated employee number", async () => {
    const employee = await createEmployeeWithContract("1000.00");
    expect(employee.employeeNumber).toMatch(/^EMP-/);
    expect(employee.status).toBe("ACTIVE");
  });

  it("records attendance idempotently per employee per day", async () => {
    const employee = await createEmployeeWithContract("1000.00");
    const date = `${thisYear}-01-10`;

    await request(app.getHttpServer())
      .post("/hr/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, date, status: "PRESENT" })
      .expect(201);

    // Recording the same date again corrects it rather than duplicating.
    await request(app.getHttpServer())
      .post("/hr/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, date, status: "LATE", overtimeHours: "1.5" })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/hr/attendance?employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe("LATE");
    expect(list.body[0].overtimeHours).toBe("1.5");
  });

  it("leave request workflow: pending -> approved, and can't be re-decided", async () => {
    const employee = await createEmployeeWithContract("1000.00");
    const leave = await request(app.getHttpServer())
      .post("/hr/leaves")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, type: "ANNUAL", startDate: `${thisYear}-02-01`, endDate: `${thisYear}-02-03` })
      .expect(201);
    expect(leave.body.status).toBe("PENDING");

    const approved = await request(app.getHttpServer())
      .patch(`/hr/leaves/${leave.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "APPROVED" })
      .expect(200);
    expect(approved.body.status).toBe("APPROVED");

    const reDecide = await request(app.getHttpServer())
      .patch(`/hr/leaves/${leave.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "REJECTED" })
      .expect(400);
    expect(reDecide.body.message).toMatch(/already approved/);
  });

  it("grants an employee loan and posts DR Employee Loans Receivable / CR funding account", async () => {
    const employee = await createEmployeeWithContract("1000.00");
    const loan = await request(app.getHttpServer())
      .post("/hr/loans")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, amount: "300.00", installments: 3, startDate: `${thisYear}-01-15`, fundingAccountId: accounts["1111"] })
      .expect(201);
    expect(loan.body.remainingBalance).toBe("300");

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: loan.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const receivableLine = je.lines.find((l) => l.account.code === "1160");
    const cashLine = je.lines.find((l) => l.account.code === "1111");
    expect(receivableLine?.debit.toFixed(4)).toBe("300.0000");
    expect(cashLine?.credit.toFixed(4)).toBe("300.0000");
  });

  it("payroll run: auto-generates BASIC items, accepts allowance/deduction/loan-repayment items, and posts one balanced entry", async () => {
    // Isolated company: payroll draft generation scoops up every active
    // employee's current contract, so this needs to be the only employee
    // in the company for the gross-pay assertions below to be exact.
    const co = await registerCompany("Payroll Run Co");
    const employee = await createEmployeeWithContract("1000.00", co.token);
    const loan = await request(app.getHttpServer())
      .post("/hr/loans")
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, amount: "300.00", installments: 3, startDate: `${thisYear}-01-15`, fundingAccountId: co.accounts["1111"] })
      .expect(201);

    const run = await request(app.getHttpServer())
      .post("/hr/payroll-runs")
      .set("Authorization", `Bearer ${co.token}`)
      .send({ periodId: co.periods[`${thisYear}-01`] })
      .expect(201);
    const basicItem = run.body.items.find((i: any) => i.employeeId === employee.id && i.type === "BASIC");
    expect(basicItem.amount).toBe("1000");
    expect(run.body.items).toHaveLength(1); // just the one employee's BASIC item

    // A second draft for the same period is rejected.
    const dup = await request(app.getHttpServer())
      .post("/hr/payroll-runs")
      .set("Authorization", `Bearer ${co.token}`)
      .send({ periodId: co.periods[`${thisYear}-01`] })
      .expect(400);
    expect(dup.body.message).toMatch(/already exists/);

    await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/items`)
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, type: "ALLOWANCE", amount: "200.00" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/items`)
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, type: "DEDUCTION", amount: "50.00", note: "Unpaid half-day" })
      .expect(201);

    // Repaying more than the loan's remaining balance is rejected.
    const overRepay = await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/items`)
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, type: "LOAN_REPAYMENT", amount: "500.00", loanId: loan.body.id })
      .expect(400);
    expect(overRepay.body.message).toMatch(/exceeds remaining loan balance/);

    await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/items`)
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, type: "LOAN_REPAYMENT", amount: "100.00", loanId: loan.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/approve`)
      .set("Authorization", `Bearer ${co.token}`)
      .expect(201);

    // Can't modify once approved.
    const modifyAfterApprove = await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/items`)
      .set("Authorization", `Bearer ${co.token}`)
      .send({ employeeId: employee.id, type: "ALLOWANCE", amount: "10.00" })
      .expect(400);
    expect(modifyAfterApprove.body.message).toMatch(/approved/);

    const posted = await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/post`)
      .set("Authorization", `Bearer ${co.token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    expect(posted.body.postedJournalEntryId).toBeTruthy();

    // Gross = 1000 + 200 = 1200; net = 1200 - 50 (deduction) - 100 (loan repayment) = 1050.
    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const expenseLine = je.lines.find((l) => l.account.code === "5410");
    const payableLine = je.lines.find((l) => l.account.code === "2140");
    const deductionsLine = je.lines.find((l) => l.account.code === "2150");
    const loansReceivableLine = je.lines.find((l) => l.account.code === "1160");
    expect(expenseLine?.debit.toFixed(4)).toBe("1200.0000");
    expect(payableLine?.credit.toFixed(4)).toBe("1050.0000");
    expect(deductionsLine?.credit.toFixed(4)).toBe("50.0000");
    expect(loansReceivableLine?.credit.toFixed(4)).toBe("100.0000");

    const totalDebit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);

    const updatedLoan = await adminDb.loan.findUniqueOrThrow({ where: { id: loan.body.id } });
    expect(updatedLoan.remainingBalance.toFixed(4)).toBe("200.0000");
  });

  it("removeItem works while draft, and an empty run cannot be approved", async () => {
    const co = await registerCompany("Payroll Empty Co");
    const employee = await createEmployeeWithContract("500.00", co.token);
    const run = await request(app.getHttpServer())
      .post("/hr/payroll-runs")
      .set("Authorization", `Bearer ${co.token}`)
      .send({ periodId: co.periods[`${thisYear}-03`] })
      .expect(201);
    const basicItem = run.body.items.find((i: any) => i.employeeId === employee.id);

    await request(app.getHttpServer())
      .delete(`/hr/payroll-runs/${run.body.id}/items/${basicItem.id}`)
      .set("Authorization", `Bearer ${co.token}`)
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post(`/hr/payroll-runs/${run.body.id}/approve`)
      .set("Authorization", `Bearer ${co.token}`)
      .expect(400);
    expect(rejected.body.message).toMatch(/empty/);
  });
});
