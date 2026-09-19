import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 12 acceptance tests — governance: the audit trail (wired through
 * JournalEntriesService.post()/reverse(), the sole posting choke point,
 * plus login) and the generic approval-workflow engine, demonstrated
 * end-to-end on Purchase Invoice posting. Exercised through real HTTP
 * against real PostgreSQL, same standard as every other phase.
 */
describe("Governance: audit log + approval workflows (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `gov.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let unitId: string;
  let warehouseId: string;
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
      .send({ companyName: "Governance Test Co", baseCurrencyCode: "JOD", adminFullName: "Gov Admin", adminEmail, adminPassword: password })
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
    const supplier = await request(app.getHttpServer()).post("/suppliers").set("Authorization", `Bearer ${token}`).send({ code: "SUP-1", name: "Supplier" }).expect(201);
    supplierId = supplier.body.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  async function createPurchaseInvoice(unitCost: string, qty: string = "1") {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `GOV-${unique}-${Math.random()}`, name: "Governed Widget", baseUnitId: unitId })
      .expect(201);
    const draft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId: item.body.id, warehouseId, qty, unitCost }] })
      .expect(201);
    return draft.body;
  }

  it("login writes a LOGIN audit entry, and posting a journal entry writes a POST audit entry", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: adminEmail, password })
      .expect(201);

    const logs = await request(app.getHttpServer()).get("/audit-logs").set("Authorization", `Bearer ${token}`).expect(200);
    expect(logs.body.some((l: any) => l.action === "LOGIN" && l.entityType === "User")).toBe(true);

    // A cheap way to get a POST audit entry without a whole invoice: post
    // a below-threshold purchase invoice (no approval workflow configured
    // yet in this test run, so it posts straight through).
    const invoice = await createPurchaseInvoice("1.00");
    const posted = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const logsAfter = await request(app.getHttpServer()).get("/audit-logs").set("Authorization", `Bearer ${token}`).expect(200);
    const postLog = logsAfter.body.find((l: any) => l.action === "POST" && l.entityType === "JournalEntry" && l.entityId === posted.body.postedJournalEntryId);
    expect(postLog).toBeTruthy();
    expect(postLog.after.sourceType).toBe("PURCHASE_INVOICE");
  });

  it("reversing a posted journal entry writes a REVERSE audit entry", async () => {
    const invoice = await createPurchaseInvoice("2.00");
    const posted = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/accounting/journal-entries/${posted.body.postedJournalEntryId}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const logs = await request(app.getHttpServer()).get("/audit-logs").set("Authorization", `Bearer ${token}`).expect(200);
    const reverseLog = logs.body.find((l: any) => l.action === "REVERSE" && l.entityId === posted.body.postedJournalEntryId);
    expect(reverseLog).toBeTruthy();
    expect(reverseLog.before.status).toBe("POSTED");
    expect(reverseLog.after.status).toBe("REVERSED");
  });

  it("a purchase invoice below the configured threshold posts without any approval gate", async () => {
    await request(app.getHttpServer())
      .post("/approvals/workflows")
      .set("Authorization", `Bearer ${token}`)
      .send({
        docType: "PURCHASE_INVOICE",
        name: "Large Purchase Approval",
        conditions: { minAmount: "500" },
        steps: [{ name: "Manager Sign-off" }],
      })
      .expect(201);

    const invoice = await createPurchaseInvoice("10.00"); // well under 500
    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
  });

  it("a purchase invoice at/above the threshold is blocked until approved, then posts", async () => {
    const invoice = await createPurchaseInvoice("600.00"); // above the 500 threshold from the prior test

    const blocked = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(blocked.body.message).toMatch(/requires approval/);

    const req = await request(app.getHttpServer())
      .post("/approvals/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ docType: "PURCHASE_INVOICE", docId: invoice.id, amount: invoice.total })
      .expect(201);
    expect(req.body.status).toBe("PENDING");

    const stillPending = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(stillPending.body.message).toMatch(/still pending/);

    const decided = await request(app.getHttpServer())
      .post(`/approvals/requests/${req.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED" })
      .expect(201);
    expect(decided.body.status).toBe("APPROVED");

    const posted = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");

    // Deciding an already-decided request is rejected.
    const redecide = await request(app.getHttpServer())
      .post(`/approvals/requests/${req.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED" })
      .expect(400);
    expect(redecide.body.message).toMatch(/already approved/);
  });

  it("a rejected approval blocks posting until a new approval is requested and granted", async () => {
    const invoice = await createPurchaseInvoice("700.00");

    const req = await request(app.getHttpServer())
      .post("/approvals/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ docType: "PURCHASE_INVOICE", docId: invoice.id, amount: invoice.total })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/approvals/requests/${req.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "REJECTED", comment: "Budget exceeded" })
      .expect(201);

    const rejectedPost = await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(rejectedPost.body.message).toMatch(/was rejected/);

    // Re-requesting after a rejection is allowed (fix-and-resubmit).
    const req2 = await request(app.getHttpServer())
      .post("/approvals/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ docType: "PURCHASE_INVOICE", docId: invoice.id, amount: invoice.total })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/approvals/requests/${req2.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${invoice.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
  });

  it("only the step's designated approver role can decide it", async () => {
    const roles = await request(app.getHttpServer()).get("/roles").set("Authorization", `Bearer ${token}`).expect(200);
    const someOtherRole = roles.body.find((r: any) => r.name !== "Company Admin");
    expect(someOtherRole).toBeTruthy();

    await request(app.getHttpServer())
      .post("/approvals/workflows")
      .set("Authorization", `Bearer ${token}`)
      .send({
        docType: "PURCHASE_INVOICE_ROLE_GATED",
        name: "Role-gated Approval",
        steps: [{ name: "Specific Role Only", approverRoleId: someOtherRole.id }],
      })
      .expect(201);

    const req = await request(app.getHttpServer())
      .post("/approvals/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ docType: "PURCHASE_INVOICE_ROLE_GATED", docId: `any-doc-id-${unique}`, amount: "1" })
      .expect(201);

    // The admin's own role is "Company Admin", not the designated approver role.
    const forbidden = await request(app.getHttpServer())
      .post(`/approvals/requests/${req.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED" })
      .expect(403);
    expect(forbidden.body.message).toMatch(/not the designated approver/);
  });
});
