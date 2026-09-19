import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 5 acceptance tests — customers/suppliers/items and, most
 * importantly, that posting a real sales or purchase invoice creates a
 * correct, balanced journal entry automatically (the Phase 5 roadmap DoD
 * in docs/ARCHITECTURE.md: "فاتورة مبيعات/شراء تُرحّل وتُنشئ قيدًا صحيحًا
 * تلقائيًا"), all through real HTTP requests against real PostgreSQL.
 *
 * Since Phase 6, posting a sales invoice also actually reduces warehouse
 * stock and books COGS (see inventory.e2e-spec.ts for the dedicated FIFO /
 * weighted-average / overselling tests) — so this file purchases stock
 * first, then sells it, exactly like a real user would have to.
 */
describe("Sales & Purchasing (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `sp.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let companyId: string;
  let unitId: string;
  let itemId: string;
  let warehouseId: string;
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
      .send({
        companyName: "Sales Purchasing Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "SP Admin",
        adminEmail,
        adminPassword: password,
      })
      .expect(201);
    token = reg.body.accessToken;
    companyId = reg.body.companyId;

    await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);

    const unit = await request(app.getHttpServer())
      .post("/catalog/units")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "PCS", name: "Pieces" })
      .expect(201);
    unitId = unit.body.id;

    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "CHAIR-001", name: "Office Chair", baseUnitId: unitId })
      .expect(201);
    itemId = item.body.id;

    const warehouse = await request(app.getHttpServer())
      .post("/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "MAIN", name: "Main Warehouse" })
      .expect(201);
    warehouseId = warehouse.body.id;

    const customer = await request(app.getHttpServer())
      .post("/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "CUST-001", name: "Acme Trading" })
      .expect(201);
    customerId = customer.body.id;

    const supplier = await request(app.getHttpServer())
      .post("/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SUP-001", name: "Wood Supplies Co" })
      .expect(201);
    supplierId = supplier.body.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("account mappings were auto-configured at company creation", async () => {
    const res = await request(app.getHttpServer())
      .get("/accounting/account-mappings")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const keys = res.body.map((m: any) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "DEFAULT_AR",
        "DEFAULT_AP",
        "DEFAULT_SALES_REVENUE",
        "DEFAULT_INVENTORY",
        "DEFAULT_COGS",
        "DEFAULT_INVENTORY_ADJUSTMENT",
        "DEFAULT_TAX_PAYABLE",
      ]),
    );
  });

  it("creates and posts a purchase invoice: correct GL entry, and stock physically received", async () => {
    const draft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        invoiceDate: today,
        lines: [{ itemId, warehouseId, qty: "20", unitCost: "60.00" }],
      })
      .expect(201);
    expect(draft.body.invoiceNumber).toMatch(/^PINV-/);

    const posted = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const inventoryLine = je.lines.find((l) => l.account.code === "1144");
    const apLine = je.lines.find((l) => l.account.code === "2111");
    expect(inventoryLine?.debit.toFixed(4)).toBe("1200.0000"); // 20 x 60
    expect(apLine?.credit.toFixed(4)).toBe("1200.0000");

    const balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("20.0000");
  });

  it("creates and posts a sales invoice: correct GL (AR/Revenue/COGS/Inventory), stock actually reduced", async () => {
    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId,
        invoiceDate: today,
        lines: [{ itemId, warehouseId, qty: "3", unitPrice: "150.00", discountAmount: "0" }],
      })
      .expect(201);
    expect(draft.body.status).toBe("DRAFT");
    // Prisma Decimal JSON-serializes via toString(), which drops trailing
    // zeros (450.0000 -> "450") — the report endpoints below use .toFixed(4)
    // explicitly and do keep them, which is what end users actually see.
    expect(draft.body.subtotal).toBe("450");
    expect(draft.body.invoiceNumber).toMatch(/^INV-/);

    const posted = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    expect(posted.body.postedJournalEntryId).toBeTruthy();

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    expect(je.status).toBe("POSTED");
    expect(je.sourceType).toBe("SALES_INVOICE");
    expect(je.sourceId).toBe(draft.body.id);
    const arLine = je.lines.find((l) => l.account.code === "1131");
    const revenueLine = je.lines.find((l) => l.account.code === "4100");
    const cogsLine = je.lines.find((l) => l.account.code === "5110");
    const inventoryLine = je.lines.find((l) => l.account.code === "1144");
    expect(arLine?.debit.toFixed(4)).toBe("450.0000");
    expect(revenueLine?.credit.toFixed(4)).toBe("450.0000");
    // Cost basis was 60/unit from the purchase above -> 3 x 60 = 180 COGS,
    // independent of the 150/unit sale price.
    expect(cogsLine?.debit.toFixed(4)).toBe("180.0000");
    expect(inventoryLine?.credit.toFixed(4)).toBe("180.0000");

    const balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("17.0000"); // 20 - 3

    const tb = await request(app.getHttpServer())
      .get("/accounting/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(tb.body.totalDebit).toBe(tb.body.totalCredit);
    const arRow = tb.body.rows.find((r: any) => r.code === "1131");
    expect(arRow.balance).toBe("450.0000");
  });

  it("rejects posting a sales invoice twice", async () => {
    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitPrice: "10" }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(res.body.message).toMatch(/already posted/i);
  });

  it("uses a customer's overridden AR account instead of the company default when set", async () => {
    const altAccounts = await request(app.getHttpServer())
      .get("/accounting/accounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const altAr = altAccounts.body.find((a: any) => a.code === "1132"); // Allowance for Doubtful Accounts (just a distinct real account for this test)

    const custWithOverride = await request(app.getHttpServer())
      .post("/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "CUST-002", name: "VIP Client", arAccountId: altAr.id })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId: custWithOverride.body.id,
        invoiceDate: today,
        lines: [{ itemId, warehouseId, qty: "1", unitPrice: "100" }],
      })
      .expect(201);
    const posted = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const arLine = je.lines.find((l) => l.debit.toFixed(4) === "100.0000");
    expect(arLine?.account.code).toBe("1132");
  });

  it("denies creating a sales invoice for a role without sales permissions (RBAC)", async () => {
    const auditorRole = await adminDb.role.findFirstOrThrow({ where: { companyId, name: "Auditor" } });
    const bcrypt = await import("bcryptjs");
    const auditorEmail = `sp.auditor.${unique}@accora.test`;
    const auditorUser = await adminDb.user.create({
      data: { email: auditorEmail, passwordHash: await bcrypt.hash(password, 12), fullName: "Auditor" },
    });
    await adminDb.userCompanyAccess.create({ data: { userId: auditorUser.id, companyId, roleId: auditorRole.id } });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email: auditorEmail, password }).expect(201);

    // Auditor is read-only everywhere -> can view but not create.
    await request(app.getHttpServer())
      .get("/sales/invoices")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitPrice: "10" }] })
      .expect(403);
  });
});
