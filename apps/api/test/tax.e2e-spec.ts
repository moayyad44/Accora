import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 10a acceptance tests — configurable tax: tax types/rates/groups,
 * and wiring a tax group into a sales invoice line so each rate posts to
 * its own payable account (a group can bundle several rates, each with a
 * different account — never one flat "tax payable" bucket). Exercised
 * through real HTTP against real PostgreSQL, same standard as every
 * other phase.
 */
describe("Tax: types/rates/groups, sales invoice wiring (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `tax.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let unitId: string;
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
      .send({ companyName: "Tax Test Co", baseCurrencyCode: "JOD", adminFullName: "Tax Admin", adminEmail, adminPassword: password })
      .expect(201);
    token = reg.body.accessToken;

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

    const wh = await request(app.getHttpServer())
      .post("/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "MAIN", name: "Main Warehouse" })
      .expect(201);
    warehouseId = wh.body.id;

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

  async function createAccount(code: string, name: string) {
    const res = await request(app.getHttpServer())
      .post("/accounting/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, name, accountType: "LIABILITY", normalBalance: "CREDIT" })
      .expect(201);
    return res.body.id;
  }

  it("creates a tax type and rate, and rejects a negative rate", async () => {
    const type = await request(app.getHttpServer())
      .post("/tax/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `VAT-${unique}` })
      .expect(201);

    const payableAccountId = await createAccount(`9${unique}`.slice(0, 6), "VAT Payable Test");

    const rate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "16%", rate: "16.000", payableAccountId, effectiveDate: today })
      .expect(201);
    expect(rate.body.rate).toBe("16");

    const rejected = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "bad", rate: "-5", payableAccountId, effectiveDate: today })
      .expect(400);
    expect(rejected.body.message).toMatch(/cannot be negative/);
  });

  it("wires a single-rate tax group into a sales invoice: tax posts to the rate's own account", async () => {
    const type = await request(app.getHttpServer())
      .post("/tax/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `GST-${unique}` })
      .expect(201);
    const payableAccountId = await createAccount(`8${unique}`.slice(0, 6), "GST Payable Test");
    const rate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "16%", rate: "16", payableAccountId, effectiveDate: today })
      .expect(201);

    const group = await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Standard-${unique}`, taxRateIds: [rate.body.id] })
      .expect(201);

    // Stock the item first via a (tax-free) purchase so the sale can ship.
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `TAXITEM-${unique}`, name: "Taxable Widget", baseUnitId: unitId })
      .expect(201);
    const itemId = item.body.id;
    const purchaseDraft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "10", unitCost: "5.00" }] })
      .expect(201);
    await request(app.getHttpServer()).post(`/purchasing/invoices/${purchaseDraft.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    // Sale: 2 units @ 100 = 200 subtotal, 16% tax = 32.
    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "2", unitPrice: "100.00", taxGroupId: group.body.id }] })
      .expect(201);
    expect(draft.body.lines[0].taxAmount).toBe("32");
    expect(draft.body.taxTotal).toBe("32");
    expect(draft.body.total).toBe("232");

    const posted = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const arLine = je.lines.find((l) => l.account.code === "1131"); // Trade Receivables
    const revenueLine = je.lines.find((l) => l.account.code === "4100"); // Sales Revenue
    const taxLine = je.lines.find((l) => l.account.id === payableAccountId);
    expect(arLine?.debit.toFixed(4)).toBe("232.0000");
    expect(revenueLine?.credit.toFixed(4)).toBe("200.0000");
    expect(taxLine?.credit.toFixed(4)).toBe("32.0000");
  });

  it("a multi-rate tax group posts each rate to its own account", async () => {
    const type = await request(app.getHttpServer())
      .post("/tax/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Combo-${unique}` })
      .expect(201);
    const nationalAccountId = await createAccount(`7${unique}`.slice(0, 6), "National Tax Payable Test");
    const municipalAccountId = await createAccount(`6${unique}`.slice(0, 6), "Municipal Tax Payable Test");

    const nationalRate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "National 10%", rate: "10", payableAccountId: nationalAccountId, effectiveDate: today })
      .expect(201);
    const municipalRate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "Municipal 2%", rate: "2", payableAccountId: municipalAccountId, effectiveDate: today })
      .expect(201);

    const group = await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Combo-Group-${unique}`, taxRateIds: [nationalRate.body.id, municipalRate.body.id] })
      .expect(201);

    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `COMBOITEM-${unique}`, name: "Combo Widget", baseUnitId: unitId })
      .expect(201);
    const itemId = item.body.id;
    const purchaseDraft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "5", unitCost: "1.00" }] })
      .expect(201);
    await request(app.getHttpServer()).post(`/purchasing/invoices/${purchaseDraft.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    // 1 unit @ 1000 = 1000 subtotal; national 10% = 100, municipal 2% = 20 -> tax total 120.
    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitPrice: "1000.00", taxGroupId: group.body.id }] })
      .expect(201);
    expect(draft.body.taxTotal).toBe("120");

    const posted = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const nationalLine = je.lines.find((l) => l.account.id === nationalAccountId);
    const municipalLine = je.lines.find((l) => l.account.id === municipalAccountId);
    expect(nationalLine?.credit.toFixed(4)).toBe("100.0000");
    expect(municipalLine?.credit.toFixed(4)).toBe("20.0000");

    const totalDebit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("a purchase invoice's tax debits the rate's own (input-tax) account, keeping the entry balanced", async () => {
    const type = await request(app.getHttpServer())
      .post("/tax/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `InputVAT-${unique}` })
      .expect(201);
    const recoverableAccountId = await createAccount(`5${unique}`.slice(0, 6), "VAT Recoverable Test");
    const rate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "16%", rate: "16", payableAccountId: recoverableAccountId, effectiveDate: today })
      .expect(201);
    const group = await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Input-Group-${unique}`, taxRateIds: [rate.body.id] })
      .expect(201);

    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `PURCHTAX-${unique}`, name: "Purchased Widget", baseUnitId: unitId })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        invoiceDate: today,
        lines: [{ itemId: item.body.id, warehouseId, qty: "10", unitCost: "10.00", taxGroupId: group.body.id }],
      })
      .expect(201);
    // subtotal 100, tax 16% = 16, total 116.
    expect(draft.body.taxTotal).toBe("16");
    expect(draft.body.total).toBe("116");

    const posted = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const inventoryLine = je.lines.find((l) => l.account.code === "1144");
    const taxLine = je.lines.find((l) => l.account.id === recoverableAccountId);
    const apLine = je.lines.find((l) => l.account.code === "2111");
    expect(inventoryLine?.debit.toFixed(4)).toBe("100.0000");
    expect(taxLine?.debit.toFixed(4)).toBe("16.0000");
    expect(apLine?.credit.toFixed(4)).toBe("116.0000");

    const totalDebit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("rejects a duplicate tax group name and an empty rate list", async () => {
    const type = await request(app.getHttpServer())
      .post("/tax/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Dup-${unique}` })
      .expect(201);
    const accountId = await createAccount(`4${unique}`.slice(0, 6), "Dup Test Payable");
    const rate = await request(app.getHttpServer())
      .post("/tax/rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxTypeId: type.body.id, name: "5%", rate: "5", payableAccountId: accountId, effectiveDate: today })
      .expect(201);

    await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `OnlyOnce-${unique}`, taxRateIds: [rate.body.id] })
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `OnlyOnce-${unique}`, taxRateIds: [rate.body.id] })
      .expect(400);
    expect(dup.body.message).toMatch(/already exists/);

    const empty = await request(app.getHttpServer())
      .post("/tax/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Empty-${unique}`, taxRateIds: [] })
      .expect(400);
    expect(empty.body.message).toBeTruthy();
  });
});
