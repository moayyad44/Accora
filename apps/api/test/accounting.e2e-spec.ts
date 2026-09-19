import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 4 acceptance tests — the accounting engine (chart of accounts,
 * fiscal periods, journal entries, trial balance / general ledger),
 * exercised entirely through real HTTP requests against a real Postgres
 * instance, exactly as the Phase 4 roadmap entry in docs/ARCHITECTURE.md
 * requires: "لا يمكن إنشاء قيد غير متوازن، اختبارات Posting Engine تمر".
 */
describe("Accounting engine (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `accounting.admin.${unique}@accora.test`;
  const salesEmail = `accounting.sales.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let companyId: string;
  let token: string;
  let cashAccountId: string;
  let salesRevenueAccountId: string;
  let headerAccountId: string;
  let openPeriodId: string;
  let postedEntryId: string;

  const thisYear = new Date().getUTCFullYear();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Accounting Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "Accounting Admin",
        adminEmail,
        adminPassword: password,
      })
      .expect(201);
    companyId = reg.body.companyId;
    token = reg.body.accessToken;

    const accounts = await request(app.getHttpServer())
      .get("/accounting/accounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    cashAccountId = accounts.body.find((a: any) => a.code === "1111").id; // Cash on Hand
    salesRevenueAccountId = accounts.body.find((a: any) => a.code === "4100").id; // Sales Revenue
    headerAccountId = accounts.body.find((a: any) => a.code === "1000").id; // Assets (header)

    const fy = await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);
    expect(fy.body.periods).toHaveLength(12);
    openPeriodId = fy.body.periods.find((p: any) => new Date(p.startDate) <= new Date() && new Date(p.endDate) >= new Date()).id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("rejects a journal entry against a header account", async () => {
    const res = await request(app.getHttpServer())
      .post("/accounting/journal-entries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entryDate: new Date().toISOString().slice(0, 10),
        lines: [
          { accountId: headerAccountId, debit: "100" },
          { accountId: salesRevenueAccountId, credit: "100" },
        ],
      })
      .expect(400);
    expect(res.body.message).toMatch(/header account/i);
  });

  it("rejects an unbalanced journal entry with a clear error, never creates it", async () => {
    const res = await request(app.getHttpServer())
      .post("/accounting/journal-entries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entryDate: new Date().toISOString().slice(0, 10),
        lines: [
          { accountId: cashAccountId, debit: "500" },
          { accountId: salesRevenueAccountId, credit: "400" },
        ],
      })
      .expect(400);
    expect(res.body.message).toMatch(/not balanced/i);

    const entries = await adminDb.journalEntry.findMany({ where: { companyId } });
    expect(entries).toHaveLength(0);
  });

  it("creates a balanced draft entry, then posts it", async () => {
    const draft = await request(app.getHttpServer())
      .post("/accounting/journal-entries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entryDate: new Date().toISOString().slice(0, 10),
        description: "Cash sale",
        lines: [
          { accountId: cashAccountId, debit: "500" },
          { accountId: salesRevenueAccountId, credit: "500" },
        ],
      })
      .expect(201);
    expect(draft.body.status).toBe("DRAFT");
    expect(draft.body.entryNumber).toMatch(/^JV-/);

    const posted = await request(app.getHttpServer())
      .post(`/accounting/journal-entries/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    postedEntryId = posted.body.id;
  });

  it("reflects the posted entry correctly in the trial balance", async () => {
    const res = await request(app.getHttpServer())
      .get("/accounting/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.totalDebit).toBe(res.body.totalCredit); // the DB guarantee, visible through the report too
    const cashRow = res.body.rows.find((r: any) => r.accountId === cashAccountId);
    const salesRow = res.body.rows.find((r: any) => r.accountId === salesRevenueAccountId);
    expect(cashRow.balance).toBe("500.0000");
    expect(salesRow.balance).toBe("500.0000");
  });

  it("reflects the posted entry in the account's general ledger with a running balance", async () => {
    const res = await request(app.getHttpServer())
      .get(`/accounting/reports/general-ledger/${cashAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.endingBalance).toBe("500.0000");
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].debit).toBe("500.0000");
  });

  it("reverses the posted entry: original becomes REVERSED, a new POSTED reversal entry cancels it out", async () => {
    const reversal = await request(app.getHttpServer())
      .post(`/accounting/journal-entries/${postedEntryId}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(reversal.body.status).toBe("POSTED");

    const original = await adminDb.journalEntry.findUniqueOrThrow({ where: { id: postedEntryId } });
    expect(original.status).toBe("REVERSED");

    const tb = await request(app.getHttpServer())
      .get("/accounting/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const cashRow = tb.body.rows.find((r: any) => r.accountId === cashAccountId);
    expect(cashRow.balance).toBe("0.0000");
  });

  it("blocks posting a new entry once its fiscal period is closed", async () => {
    await request(app.getHttpServer())
      .patch(`/accounting/fiscal-years/periods/${openPeriodId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CLOSED" })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post("/accounting/journal-entries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entryDate: new Date().toISOString().slice(0, 10),
        lines: [
          { accountId: cashAccountId, debit: "10" },
          { accountId: salesRevenueAccountId, credit: "10" },
        ],
      })
      .expect(403);
    expect(res.body.message).toMatch(/closed/i);
  });

  it("denies journal entry creation for a role without accounting permissions (RBAC)", async () => {
    const salesRole = await adminDb.role.findFirstOrThrow({ where: { companyId, name: "Sales" } });
    const bcrypt = await import("bcryptjs");
    const salesUser = await adminDb.user.create({
      data: { email: salesEmail, passwordHash: await bcrypt.hash(password, 12), fullName: "Sales Rep" },
    });
    await adminDb.userCompanyAccess.create({ data: { userId: salesUser.id, companyId, roleId: salesRole.id } });

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: salesEmail, password })
      .expect(201);

    await request(app.getHttpServer())
      .post("/accounting/journal-entries")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        entryDate: new Date().toISOString().slice(0, 10),
        lines: [
          { accountId: cashAccountId, debit: "10" },
          { accountId: salesRevenueAccountId, credit: "10" },
        ],
      })
      .expect(403);
  });
});
