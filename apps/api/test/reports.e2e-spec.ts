import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 11 acceptance tests — financial reports and the dashboard:
 * Income Statement, Balance Sheet, AR/AP Aging (invoice-linked
 * receipts/payments), and the summary endpoint. All exercised through
 * real HTTP against real PostgreSQL, same standard as every other phase.
 */
describe("Reports & Dashboard: Income Statement, Balance Sheet, AR/AP Aging (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `reports.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let unitId: string;
  let warehouseId: string;
  let customerId: string;
  let supplierId: string;
  let cashAccountId: string;
  let salesInvoiceId: string;
  let purchaseInvoiceId: string;
  const thisYear = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({ companyName: "Reports Test Co", baseCurrencyCode: "JOD", adminFullName: "Reports Admin", adminEmail, adminPassword: password })
      .expect(201);
    token = reg.body.accessToken;

    await request(app.getHttpServer())
      .post("/accounting/fiscal-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FY${thisYear}`, startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
      .expect(201);

    const unit = await request(app.getHttpServer()).post("/catalog/units").set("Authorization", `Bearer ${token}`).send({ code: "PCS", name: "Pieces" }).expect(201);
    unitId = unit.body.id;

    const wh = await request(app.getHttpServer()).post("/inventory/warehouses").set("Authorization", `Bearer ${token}`).send({ code: "MAIN", name: "Main Warehouse" }).expect(201);
    warehouseId = wh.body.id;

    const customer = await request(app.getHttpServer()).post("/customers").set("Authorization", `Bearer ${token}`).send({ code: "CUST-1", name: "Customer" }).expect(201);
    customerId = customer.body.id;

    const supplier = await request(app.getHttpServer()).post("/suppliers").set("Authorization", `Bearer ${token}`).send({ code: "SUP-1", name: "Supplier" }).expect(201);
    supplierId = supplier.body.id;

    const accts = await request(app.getHttpServer()).get("/accounting/accounts").set("Authorization", `Bearer ${token}`).expect(200);
    const cashGlAccountId = accts.body.find((a: any) => a.code === "1111").id;
    const cashAccount = await request(app.getHttpServer())
      .post("/banking/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Main Cash Box", type: "CASH", accountId: cashGlAccountId })
      .expect(201);
    cashAccountId = cashAccount.body.id;

    const item = await request(app.getHttpServer()).post("/catalog/items").set("Authorization", `Bearer ${token}`).send({ sku: `RPT-${unique}`, name: "Reported Widget", baseUnitId: unitId }).expect(201);
    const itemId = item.body.id;

    // Purchase: 10 units @ 5.00 = 50.00, due 40 days ago (will land in AP aging's 31-60 bucket).
    const pDraft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, dueDate: fortyDaysAgo, lines: [{ itemId, warehouseId, qty: "10", unitCost: "5.00" }] })
      .expect(201);
    purchaseInvoiceId = pDraft.body.id;
    await request(app.getHttpServer()).post(`/purchasing/invoices/${purchaseInvoiceId}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    // Sale: 4 units @ 20.00 = 80.00 subtotal, COGS 4*5=20.00, due today (AR aging's "current" bucket).
    const sDraft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, dueDate: today, lines: [{ itemId, warehouseId, qty: "4", unitPrice: "20.00" }] })
      .expect(201);
    salesInvoiceId = sDraft.body.id;
    await request(app.getHttpServer()).post(`/sales/invoices/${salesInvoiceId}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    // Partial receipt from the customer (30 of 80), linked to the invoice.
    const rv = await request(app.getHttpServer())
      .post("/banking/receipt-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, voucherDate: today, partyType: "CUSTOMER", customerId, salesInvoiceId, amount: "30.00" })
      .expect(201);
    await request(app.getHttpServer()).post(`/banking/receipt-vouchers/${rv.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    // Partial payment to the supplier (20 of 50), linked to the invoice.
    const pv = await request(app.getHttpServer())
      .post("/banking/payment-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashBankAccountId: cashAccountId, voucherDate: today, partyType: "SUPPLIER", supplierId, purchaseInvoiceId, amount: "20.00" })
      .expect(201);
    await request(app.getHttpServer()).post(`/banking/payment-vouchers/${pv.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("income statement: revenue 80, COGS expense 20, net income 60 for the period", async () => {
    const res = await request(app.getHttpServer())
      .get(`/accounting/reports/income-statement?dateFrom=${thisYear}-01-01&dateTo=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.totalRevenue).toBe("80.0000");
    expect(res.body.totalExpenses).toBe("20.0000");
    expect(res.body.netIncome).toBe("60.0000");
    const revenueRow = res.body.revenue.find((r: any) => r.code === "4100");
    const cogsRow = res.body.expenses.find((r: any) => r.code === "5110");
    expect(revenueRow.amount).toBe("80.0000");
    expect(cogsRow.amount).toBe("20.0000");
  });

  it("balance sheet balances (Assets = Liabilities + Equity) and includes undistributed net income", async () => {
    const res = await request(app.getHttpServer())
      .get(`/accounting/reports/balance-sheet?asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.isBalanced).toBe(true);
    expect(res.body.netIncomeUndistributed).toBe("60.0000");

    const ar = res.body.assets.find((a: any) => a.code === "1131");
    const inventory = res.body.assets.find((a: any) => a.code === "1144");
    const cash = res.body.assets.find((a: any) => a.code === "1111");
    const ap = res.body.liabilities.find((l: any) => l.code === "2111");
    // AR: invoiced 80, received 30 -> 50 remaining.
    expect(ar.balance).toBe("50.0000");
    // Inventory: bought 50 worth, shipped 20 worth -> 30 remaining.
    expect(inventory.balance).toBe("30.0000");
    // Cash: +30 receipt, -20 payment -> 10.
    expect(cash.balance).toBe("10.0000");
    // AP: invoiced 50, paid 20 -> 30 remaining.
    expect(ap.balance).toBe("30.0000");
  });

  it("AR aging shows the invoice's remaining balance in the 'current' bucket (due today)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/accounting/reports/ar-aging?asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const row = res.body.invoices.find((i: any) => i.invoiceId === salesInvoiceId);
    expect(row.total).toBe("80");
    expect(row.paid).toBe("30.0000");
    expect(row.remaining).toBe("50.0000");
    expect(row.bucket).toBe("current");

    const customerRow = res.body.byCustomer.find((c: any) => c.customerId === customerId);
    expect(customerRow.total).toBe("50.0000");
    expect(customerRow.current).toBe("50.0000");
  });

  it("AP aging shows the invoice's remaining balance in the '31-60' bucket (40 days overdue)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/accounting/reports/ap-aging?asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const row = res.body.invoices.find((i: any) => i.invoiceId === purchaseInvoiceId);
    expect(row.total).toBe("50");
    expect(row.paid).toBe("20.0000");
    expect(row.remaining).toBe("30.0000");
    expect(row.bucket).toBe("31-60");

    const supplierRow = res.body.bySupplier.find((s: any) => s.supplierId === supplierId);
    expect(supplierRow.total).toBe("30.0000");
    expect(supplierRow["31-60"]).toBe("30.0000");
  });

  it("dashboard summary matches the individual reports", async () => {
    const res = await request(app.getHttpServer())
      .get(`/dashboard/summary?asOfDate=${today}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.totalCashAndBank).toBe("10.0000");
    expect(res.body.totalAccountsReceivable).toBe("50.0000");
    expect(res.body.totalAccountsPayable).toBe("30.0000");
    expect(res.body.periodRevenue).toBe("80.0000");
    expect(res.body.periodExpenses).toBe("20.0000");
    expect(res.body.periodNetIncome).toBe("60.0000");
    expect(res.body.currentPeriod).toBeTruthy();
  });
});
