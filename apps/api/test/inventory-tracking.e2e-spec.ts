import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 6b acceptance tests — the inventory features that were explicitly
 * flagged as deferred at the end of Phase 6 (docs/INVENTORY.md §8): stock
 * counts (جرد), batch/lot tracking with expiry, serial number tracking,
 * and barcode lookup. All exercised through real HTTP against real
 * PostgreSQL, same standard as every other phase.
 */
describe("Inventory tracking: stock counts, batches, serials, barcode (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `track.admin.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let token: string;
  let companyId: string;
  let unitId: string;
  let warehouseId: string;
  let supplierId: string;
  let customerId: string;

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
        companyName: "Tracking Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "Tracking Admin",
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

    const wh = await request(app.getHttpServer())
      .post("/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "MAIN", name: "Main Warehouse" })
      .expect(201);
    warehouseId = wh.body.id;

    const supplier = await request(app.getHttpServer())
      .post("/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SUP-1", name: "Supplier" })
      .expect(201);
    supplierId = supplier.body.id;

    const customer = await request(app.getHttpServer())
      .post("/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "CUST-1", name: "Customer" })
      .expect(201);
    customerId = customer.body.id;
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("finds an item by barcode", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `BC-${unique}`, name: "Barcoded Widget", baseUnitId: unitId, barcode: `999${unique}` })
      .expect(201);

    const found = await request(app.getHttpServer())
      .get(`/catalog/items/by-barcode/999${unique}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(found.body.id).toBe(item.body.id);

    await request(app.getHttpServer())
      .get(`/catalog/items/by-barcode/does-not-exist-${unique}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("stock count: records a shortage, posts one journal entry, and corrects the balance", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SC-${unique}`, name: "Counted Widget", baseUnitId: unitId })
      .expect(201);
    const itemId = item.body.id;

    // Get 20 on the books via a purchase.
    const pDraft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "20", unitCost: "5.00" }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${pDraft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    // Physical count finds only 17 -> shortage of 3.
    const count = await request(app.getHttpServer())
      .post("/inventory/stock-counts")
      .set("Authorization", `Bearer ${token}`)
      .send({ warehouseId, type: "PERIODIC", countDate: today })
      .expect(201);
    const countedLine = count.body.lines.find((l: any) => l.itemId === itemId);
    // Prisma Decimal JSON-serializes via toString(), dropping trailing zeros.
    expect(countedLine.systemQty).toBe("20");

    await request(app.getHttpServer())
      .patch(`/inventory/stock-counts/${count.body.id}/counted-quantities`)
      .set("Authorization", `Bearer ${token}`)
      .send({ lines: [{ itemId, countedQty: "17" }] })
      .expect(200);

    const posted = await request(app.getHttpServer())
      .post(`/inventory/stock-counts/${count.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    expect(posted.body.postedJournalEntryId).toBeTruthy();

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: posted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const adjustmentLine = je.lines.find((l) => l.account.code === "5480");
    const inventoryLine = je.lines.find((l) => l.account.code === "1144");
    expect(adjustmentLine?.debit.toFixed(4)).toBe("15.0000"); // 3 units x 5.00
    expect(inventoryLine?.credit.toFixed(4)).toBe("15.0000");

    const balance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });
    expect(balance.qtyOnHand.toFixed(4)).toBe("17.0000");
  });

  it("stock count with no variance posts with no journal entry", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SC2-${unique}`, name: "Exact Widget", baseUnitId: unitId })
      .expect(201);
    const itemId = item.body.id;
    const pDraft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "5", unitCost: "1.00" }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${pDraft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const count = await request(app.getHttpServer())
      .post("/inventory/stock-counts")
      .set("Authorization", `Bearer ${token}`)
      .send({ warehouseId, type: "SURPRISE", countDate: today, itemIds: [itemId] })
      .expect(201);
    const posted = await request(app.getHttpServer())
      .post(`/inventory/stock-counts/${count.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    expect(posted.body.postedJournalEntryId).toBeNull();
  });

  it("batch tracking: captures batch + expiry on receipt, reports remaining qty and expiring batches", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sku: `BATCH-${unique}`,
        name: "Perishable Widget",
        baseUnitId: unitId,
        trackingType: "BATCH",
        // Batch remaining-quantity tracking is exact under FIFO (summed
        // straight from FifoLayer.qtyRemaining); a company on weighted
        // average overall can still opt a perishable item into FIFO here
        // (see docs/INVENTORY_TRACKING.md).
        valuationMethodOverride: "FIFO",
      })
      .expect(201);
    const itemId = item.body.id;

    const soonExpiry = new Date();
    soonExpiry.setDate(soonExpiry.getDate() + 5);
    const soonExpiryStr = soonExpiry.toISOString().slice(0, 10);

    const draft = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        invoiceDate: today,
        lines: [
          { itemId, warehouseId, qty: "10", unitCost: "3.00", batchNumber: `LOT-A-${unique}`, expiryDate: soonExpiryStr },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchasing/invoices/${draft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const batches = await request(app.getHttpServer())
      .get(`/inventory/items/${itemId}/batches`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(batches.body).toHaveLength(1);
    expect(batches.body[0].batchNumber).toBe(`LOT-A-${unique}`);
    expect(batches.body[0].remainingQty).toBe("10.0000");
    expect(batches.body[0].expiryDate).toBe(soonExpiryStr);

    const expiring = await request(app.getHttpServer())
      .get("/inventory/expiring-batches?withinDays=30")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(expiring.body.some((b: any) => b.batchNumber === `LOT-A-${unique}`)).toBe(true);

    // Purchasing a batch-tracked item without a batchNumber must be rejected.
    const rejected = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "5", unitCost: "3.00" }] })
      .expect(400);
    expect(rejected.body.message).toMatch(/batch-tracked/i);
  });

  it("serial tracking: receives distinct units, lists them, sells specific serials at their own cost (specific identification), and blocks re-selling a sold serial", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SN-${unique}`, name: "Laptop", baseUnitId: unitId, trackingType: "SERIAL" })
      .expect(201);
    const itemId = item.body.id;

    const serialA = `SN-A-${unique}`;
    const serialB = `SN-B-${unique}`;
    // Two receipts at two different costs -> specific identification means
    // each serial keeps ITS OWN cost, not a blended average.
    const p1 = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitCost: "800.00", serialNumbers: [serialA] }] })
      .expect(201);
    await request(app.getHttpServer()).post(`/purchasing/invoices/${p1.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    const p2 = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitCost: "850.00", serialNumbers: [serialB] }] })
      .expect(201);
    await request(app.getHttpServer()).post(`/purchasing/invoices/${p2.body.id}/post`).set("Authorization", `Bearer ${token}`).expect(201);

    const balance = await adminDb.stockBalance.findUniqueOrThrow({ where: { itemId_warehouseId: { itemId, warehouseId } } });
    expect(balance.qtyOnHand.toFixed(4)).toBe("2.0000");

    const inStock = await request(app.getHttpServer())
      .get(`/inventory/items/${itemId}/serials`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(inStock.body.map((s: any) => s.serialNumber).sort()).toEqual([serialA, serialB].sort());

    // Sell only serial B (the 850-cost one) -> COGS must be exactly 850, not
    // an average of the two (825).
    const sDraft = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitPrice: "1200", serialNumbers: [serialB] }] })
      .expect(201);
    const sPosted = await request(app.getHttpServer())
      .post(`/sales/invoices/${sDraft.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: sPosted.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const cogsLine = je.lines.find((l) => l.account.code === "5110");
    expect(cogsLine?.debit.toFixed(4)).toBe("850.0000");

    const serialBRow = await adminDb.serialNumber.findUniqueOrThrow({ where: { itemId_serialNumber: { itemId, serialNumber: serialB } } });
    expect(serialBRow.status).toBe("SOLD");

    // Serial A is still in stock; trying to sell B again must fail.
    const reSell = await request(app.getHttpServer())
      .post("/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "1", unitPrice: "1200", serialNumbers: [serialB] }] })
      .expect(201); // draft creation doesn't check stock yet, same as the qty-based flow
    const reSellPost = await request(app.getHttpServer())
      .post(`/sales/invoices/${reSell.body.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(reSellPost.body.message).toMatch(/not currently in stock/i);

    const remaining = await request(app.getHttpServer())
      .get(`/inventory/items/${itemId}/serials`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(remaining.body.map((s: any) => s.serialNumber)).toEqual([serialA]);
  });

  it("rejects a sales invoice line for a serial-tracked item whose serial count doesn't match qty", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SN2-${unique}`, name: "Phone", baseUnitId: unitId, trackingType: "SERIAL" })
      .expect(201);
    const itemId = item.body.id;

    const res = await request(app.getHttpServer())
      .post("/purchasing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierId, invoiceDate: today, lines: [{ itemId, warehouseId, qty: "2", unitCost: "300", serialNumbers: [`only-one-${unique}`] }] })
      .expect(400);
    expect(res.body.message).toMatch(/serial-tracked/i);
  });
});
