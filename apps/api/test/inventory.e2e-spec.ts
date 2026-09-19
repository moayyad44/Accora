import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 6 acceptance tests — the inventory engine itself: FIFO costing (each
 * unit costed at what it actually cost, oldest-first), weighted-average
 * costing, warehouse transfers, overselling rejection, and manual stock
 * adjustments with their own GL effect. The Phase 6 roadmap DoD in
 * docs/ARCHITECTURE.md: "حركة صنف صحيحة، تقييم FIFO/Weighted Average يعمل،
 * فاتورة تُخفّض المخزون فعليًا".
 */
describe("Inventory engine (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `inv.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let companyId: string;
  let unitId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let supplierId: string;
  let customerId: string;

  const thisYear = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);

  async function createItem(sku: string, valuationOverride?: "FIFO" | "WEIGHTED_AVERAGE") {
    const res = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku, name: sku, baseUnitId: unitId })
      .expect(201);
    if (valuationOverride) {
      // No dedicated endpoint yet for this override in Phase 6 — set it
      // directly via the admin DB connection, same pattern used elsewhere
      // in these tests for fixtures the API doesn't expose yet.
      await adminDb.item.update({ where: { id: res.body.id }, data: { valuationMethodOverride: valuationOverride } });
    }
    return res.body.id as string;
  }

  async function purchase(itemId: string, warehouseId: string, qty: string, unitCost: string) {
    const draft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty, unitCost }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
  }

  async function sell(itemId: string, warehouseId: string, qty: string, unitPrice: string) {
    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty, unitPrice }] })
      .expect(201);
    return request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Inventory Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "Inventory Admin",
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

    const wA = await request(app.getHttpServer())
      .post("/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "WH-A", name: "Warehouse A" })
      .expect(201);
    warehouseAId = wA.body.id;

    const wB = await request(app.getHttpServer())
      .post("/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "WH-B", name: "Warehouse B" })
      .expect(201);
    warehouseBId = wB.body.id;

    const supplier = await request(app.getHttpServer())
      .post("/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SUP-1", name: "Test Supplier" })
      .expect(201);
    supplierId = supplier.body.id;

    const customer = await request(app.getHttpServer())
      .post("/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "CUST-1", name: "Test Customer" })
      .expect(201);
    customerId = customer.body.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("weighted average: costs a sale at the blended average of all receipts, not the latest price", async () => {
    const itemId = await createItem(`WA-${unique}`, "WEIGHTED_AVERAGE");
    await purchase(itemId, warehouseAId, "10", "10.00"); // 10 @ 10 = 100
    await purchase(itemId, warehouseAId, "10", "20.00"); // 10 @ 20 = 200
    // Blended average now (100+200)/20 = 15.00/unit

    const res = await sell(itemId, warehouseAId, "5", "999"); // sale price irrelevant to cost
    expect(res.status).toBe(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: res.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const cogsLine = je.lines.find((l) => l.account.code === "5110");
    expect(cogsLine?.debit.toFixed(4)).toBe("75.0000"); // 5 x 15.00 average

    const balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseAId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("15.0000"); // 20 - 5
    expect(balance.avgCost.toFixed(4)).toBe("15.0000"); // unchanged by a sale
  });

  it("FIFO: costs a sale at the actual price of the oldest stock first, spanning multiple receipts if needed", async () => {
    const itemId = await createItem(`FIFO-${unique}`, "FIFO");
    await purchase(itemId, warehouseAId, "10", "10.00"); // layer 1: 10 @ 10
    await purchase(itemId, warehouseAId, "10", "20.00"); // layer 2: 10 @ 20

    // Selling 15 must consume all of layer 1 (10 @ 10 = 100) plus 5 of
    // layer 2 (5 @ 20 = 100) = 200 total, NOT 15 x blended average.
    const res = await sell(itemId, warehouseAId, "15", "999");
    expect(res.status).toBe(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: res.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const cogsLine = je.lines.find((l) => l.account.code === "5110");
    expect(cogsLine?.debit.toFixed(4)).toBe("200.0000");

    const remainingLayers = await adminDb.fifoLayer.findMany({
      where: { itemId, warehouseId: warehouseAId, qtyRemaining: { gt: 0 } },
    });
    expect(remainingLayers).toHaveLength(1);
    expect(remainingLayers[0].qtyRemaining.toFixed(4)).toBe("5.0000"); // 10 left in layer 2 minus 5 consumed
    expect(remainingLayers[0].unitCost.toFixed(4)).toBe("20.0000");
  });

  it("rejects selling more than is on hand, and never touches stock or GL when it does", async () => {
    const itemId = await createItem(`OVERSELL-${unique}`);
    await purchase(itemId, warehouseAId, "5", "10.00");

    const draft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId: warehouseAId, qty: "6", unitPrice: "50" }] })
      .expect(201); // creating the DRAFT is fine, it's just a request for stock we don't have yet

    const res = await request(app.getHttpServer())
      .post(`/sales/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    const invoice = await adminDb.salesInvoice.findUniqueOrThrow({ where: { id: draft.body.id } });
    expect(invoice.status).toBe("DRAFT"); // never got marked POSTED
    const balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseAId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("5.0000"); // untouched
  });

  it("transfers stock between warehouses at its existing cost basis, with no GL effect", async () => {
    const itemId = await createItem(`XFER-${unique}`);
    await purchase(itemId, warehouseAId, "10", "25.00");

    const tbBefore = await request(app.getHttpServer())
      .get("/accounting/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/inventory/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId, fromWarehouseId: warehouseAId, toWarehouseId: warehouseBId, qty: "4" })
      .expect(201);

    const balanceA = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseAId } },
    });
    const balanceB = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseBId } },
    });
    expect(balanceA.qtyOnHand.toFixed(4)).toBe("6.0000");
    expect(balanceB.qtyOnHand.toFixed(4)).toBe("4.0000");
    expect(balanceB.avgCost.toFixed(4)).toBe("25.0000"); // cost basis preserved, not re-priced

    const tbAfter = await request(app.getHttpServer())
      .get("/accounting/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(tbAfter.body.totalDebit).toBe(tbBefore.body.totalDebit); // no journal entry was created
  });

  it("manual stock adjustment (increase and decrease) books a correct GL entry against DEFAULT_INVENTORY_ADJUSTMENT", async () => {
    const itemId = await createItem(`ADJ-${unique}`);
    await purchase(itemId, warehouseAId, "10", "10.00");

    // Found 3 extra units during a count -> increase, valued at 12/unit.
    const increase = await request(app.getHttpServer())
      .post("/inventory/adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId, warehouseId: warehouseAId, qty: "3", direction: "INCREASE", unitCost: "12.00", reason: "Count overage" })
      .expect(201);
    expect(increase.body.amount).toBe("36.0000"); // 3 x 12

    let je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: increase.body.journalEntryId },
      include: { lines: { include: { account: true } } },
    });
    expect(je.lines.find((l) => l.account.code === "1144")?.debit.toFixed(4)).toBe("36.0000");
    expect(je.lines.find((l) => l.account.code === "5480")?.credit.toFixed(4)).toBe("36.0000");

    let balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseAId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("13.0000"); // 10 + 3

    // Found 2 short -> decrease, costed from existing valuation (no unitCost
    // needed): average after the increase above is (10x10 + 3x12)/13 =
    // 10.4615/unit, so 2 units = 20.9230 — not a guess, the actual average.
    const decrease = await request(app.getHttpServer())
      .post("/inventory/adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId, warehouseId: warehouseAId, qty: "2", direction: "DECREASE", reason: "Count shortage" })
      .expect(201);
    expect(decrease.body.amount).toBe("20.9230");

    je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: decrease.body.journalEntryId },
      include: { lines: { include: { account: true } } },
    });
    expect(je.lines.find((l) => l.account.code === "5480")?.debit.toFixed(4)).toBe("20.9230");
    expect(je.lines.find((l) => l.account.code === "1144")?.credit.toFixed(4)).toBe("20.9230");

    balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId: warehouseAId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("11.0000"); // 13 - 2
  });
});
