import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 8 acceptance tests — fixed assets: categories, registration
 * (acquisition posting), depreciation runs (straight-line + declining
 * balance, idempotent per period), and disposal (gain/loss posting). All
 * exercised through real HTTP against real PostgreSQL, same standard as
 * every other phase.
 */
describe("Fixed Assets: categories, registration, depreciation, disposal (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `fa.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  const thisYear = new Date().getUTCFullYear();
  const accounts: Record<string, string> = {};
  let periods: Record<string, string> = {}; // "YYYY-MM" -> periodId

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Fixed Assets Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "FA Admin",
        adminEmail,
        adminPassword: password,
      })
      .expect(201);
    token = reg.body.accessToken;

    const fy = await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);
    for (const p of fy.body.periods) periods[p.name] = p.id;

    const accts = await request(app.getHttpServer())
      .get("/accounting/accounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    for (const a of accts.body) accounts[a.code] = a.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("creates an asset category and rejects a duplicate name", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Machinery-${unique}`,
        defaultDepreciationMethod: "STRAIGHT_LINE",
        defaultUsefulLifeMonths: 24,
        assetAccountId: accounts["1230"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);
    expect(cat.body.name).toBe(`Machinery-${unique}`);

    const dup = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Machinery-${unique}`,
        defaultUsefulLifeMonths: 24,
        assetAccountId: accounts["1230"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(400);
    expect(dup.body.message).toMatch(/already exists/);
  });

  it("registers an asset and posts DR asset account / CR funding account", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Vehicles-${unique}`,
        defaultUsefulLifeMonths: 24,
        assetAccountId: accounts["1250"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);

    const asset = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "Delivery Van",
        purchaseDate: `${thisYear}-01-15`,
        cost: "2400.00",
        salvageValue: "0",
        usefulLifeMonths: 24,
        fundingAccountId: accounts["2111"], // Trade Payables — bought on credit
      })
      .expect(201);
    expect(asset.body.status).toBe("ACTIVE");
    expect(asset.body.assetNumber).toMatch(/^FA-/);
    expect(asset.body.postedJournalEntryId).toBeTruthy();

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: asset.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const assetLine = je.lines.find((l) => l.account.code === "1250");
    const apLine = je.lines.find((l) => l.account.code === "2111");
    expect(assetLine?.debit.toFixed(4)).toBe("2400.0000");
    expect(apLine?.credit.toFixed(4)).toBe("2400.0000");

    // salvageValue must be strictly less than cost.
    const rejected = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "Bad Asset",
        purchaseDate: `${thisYear}-01-15`,
        cost: "1000",
        salvageValue: "1000",
        fundingAccountId: accounts["2111"],
      })
      .expect(400);
    expect(rejected.body.message).toMatch(/salvageValue must be less than cost/);
  });

  it("runs straight-line depreciation across two periods, is idempotent per period, and posts one balanced journal entry each time", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Equipment-${unique}`,
        defaultUsefulLifeMonths: 24,
        assetAccountId: accounts["1230"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);

    const asset = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "CNC Machine",
        purchaseDate: `${thisYear}-01-05`,
        usageStartDate: `${thisYear}-01-05`,
        cost: "2400.00",
        salvageValue: "0",
        usefulLifeMonths: 24, // straight-line -> 100.00/month
        fundingAccountId: accounts["2111"],
      })
      .expect(201);
    const assetId = asset.body.id;

    const run1 = await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-01`] })
      .expect(201);
    expect(run1.body.schedulesCreated).toBeGreaterThanOrEqual(1);
    expect(run1.body.journalEntryId).toBeTruthy();

    const je1 = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: run1.body.journalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const expenseLine1 = je1.lines.find((l) => l.account.code === "5440");
    const accumLine1 = je1.lines.find((l) => l.account.code === "1260");
    expect(expenseLine1?.debit.toFixed(4)).toBe(accumLine1?.credit.toFixed(4));

    const schedule1 = await adminDb.depreciationSchedule.findUniqueOrThrow({
      where: { assetId_periodId: { assetId, periodId: periods[`${thisYear}-01`] } },
    });
    expect(schedule1.amount.toFixed(4)).toBe("100.0000");
    expect(schedule1.accumulated.toFixed(4)).toBe("100.0000");

    // Re-running the same period is a no-op: nothing new for this asset.
    const rerun = await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-01`] })
      .expect(201);
    const rerunSchedule = await adminDb.depreciationSchedule.findMany({ where: { assetId } });
    expect(rerunSchedule).toHaveLength(1); // still just the one from run1

    // Next period accumulates further.
    await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-02`] })
      .expect(201);

    const schedule2 = await adminDb.depreciationSchedule.findUniqueOrThrow({
      where: { assetId_periodId: { assetId, periodId: periods[`${thisYear}-02`] } },
    });
    expect(schedule2.amount.toFixed(4)).toBe("100.0000");
    expect(schedule2.accumulated.toFixed(4)).toBe("200.0000");
  });

  it("disposal posts a loss when proceeds are below net book value", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Furniture-${unique}`,
        defaultUsefulLifeMonths: 10,
        assetAccountId: accounts["1240"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);

    const asset = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "Office Desk Set",
        purchaseDate: `${thisYear}-01-05`,
        usageStartDate: `${thisYear}-01-05`,
        cost: "1000.00",
        salvageValue: "0",
        usefulLifeMonths: 10, // 100.00/month
        fundingAccountId: accounts["1111"], // paid cash
      })
      .expect(201);
    const assetId = asset.body.id;

    await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-01`] })
      .expect(201);
    // accumulated depreciation so far = 100.00 (net book value = 900.00)

    const disposal = await request(app.getHttpServer())
      .post(`/fixed-assets/assets/${assetId}/dispose`)
      .set("Authorization", `Bearer ${token}`)
      .send({ disposalDate: `${thisYear}-02-01`, proceeds: "700.00", proceedsAccountId: accounts["1111"] })
      .expect(201);
    expect(disposal.body.status).toBe("DISPOSED");

    const disposalTx = disposal.body.transactions.find((t: any) => t.type === "DISPOSAL");
    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: disposalTx.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const assetLine = je.lines.find((l) => l.account.code === "1240");
    const accumLine = je.lines.find((l) => l.account.code === "1260");
    const cashLine = je.lines.find((l) => l.account.code === "1111");
    const gainLossLine = je.lines.find((l) => l.account.code === "5490");

    expect(assetLine?.credit.toFixed(4)).toBe("1000.0000"); // remove full cost
    expect(accumLine?.debit.toFixed(4)).toBe("100.0000"); // remove accumulated depreciation
    expect(cashLine?.debit.toFixed(4)).toBe("700.0000"); // proceeds received
    // net book value 900, proceeds 700 -> loss of 200
    expect(gainLossLine?.debit.toFixed(4)).toBe("200.0000");

    const totalDebit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);

    // Can't dispose twice.
    const redispose = await request(app.getHttpServer())
      .post(`/fixed-assets/assets/${assetId}/dispose`)
      .set("Authorization", `Bearer ${token}`)
      .send({ disposalDate: `${thisYear}-02-15` })
      .expect(400);
    expect(redispose.body.message).toMatch(/already been disposed/);
  });

  it("disposal posts a gain when proceeds exceed net book value, with no depreciation run at all", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Land-${unique}`,
        defaultUsefulLifeMonths: 120,
        assetAccountId: accounts["1210"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);

    const asset = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "Plot A",
        purchaseDate: `${thisYear}-01-05`,
        cost: "5000.00",
        salvageValue: "0",
        fundingAccountId: accounts["1121"], // bank
      })
      .expect(201);
    const assetId = asset.body.id;

    // No depreciation run -> net book value is still the full cost, 5000.
    const disposal = await request(app.getHttpServer())
      .post(`/fixed-assets/assets/${assetId}/dispose`)
      .set("Authorization", `Bearer ${token}`)
      .send({ disposalDate: `${thisYear}-03-01`, proceeds: "6000.00", proceedsAccountId: accounts["1121"] })
      .expect(201);

    const disposalTx = disposal.body.transactions.find((t: any) => t.type === "DISPOSAL");
    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: disposalTx.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const gainLossLine = je.lines.find((l) => l.account.code === "5490");
    // proceeds 6000 - net book value 5000 = gain of 1000
    expect(gainLossLine?.credit.toFixed(4)).toBe("1000.0000");
  });

  it("declining-balance depreciation applies its rate to net book value, not the depreciable base", async () => {
    const cat = await request(app.getHttpServer())
      .post("/fixed-assets/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `IT-Equipment-${unique}`,
        defaultDepreciationMethod: "DECLINING_BALANCE",
        defaultUsefulLifeMonths: 10,
        assetAccountId: accounts["1230"],
        depreciationExpenseAccountId: accounts["5440"],
        accumulatedDepreciationAccountId: accounts["1260"],
      })
      .expect(201);

    const asset = await request(app.getHttpServer())
      .post("/fixed-assets/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: cat.body.id,
        name: "Server Rack",
        purchaseDate: `${thisYear}-01-05`,
        usageStartDate: `${thisYear}-01-05`,
        cost: "1000.00",
        salvageValue: "0",
        usefulLifeMonths: 10,
        depreciationMethod: "DECLINING_BALANCE",
        fundingAccountId: accounts["1111"],
      })
      .expect(201);
    const assetId = asset.body.id;

    // rate = 2/10 = 20%. Month 1: 20% of 1000 = 200.
    await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-01`] })
      .expect(201);
    const s1 = await adminDb.depreciationSchedule.findUniqueOrThrow({
      where: { assetId_periodId: { assetId, periodId: periods[`${thisYear}-01`] } },
    });
    expect(s1.amount.toFixed(4)).toBe("200.0000");

    // Month 2: 20% of (1000-200)=800 -> 160, not 200 (proves it's on NBV, not the flat base).
    await request(app.getHttpServer())
      .post("/fixed-assets/depreciation-runs")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodId: periods[`${thisYear}-02`] })
      .expect(201);
    const s2 = await adminDb.depreciationSchedule.findUniqueOrThrow({
      where: { assetId_periodId: { assetId, periodId: periods[`${thisYear}-02`] } },
    });
    expect(s2.amount.toFixed(4)).toBe("160.0000");
    expect(s2.accumulated.toFixed(4)).toBe("360.0000");
  });
});
