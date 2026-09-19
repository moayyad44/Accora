import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 7 acceptance tests — manufacturing: work centers, BOM (incl.
 * versioning), standard costs, and the full production order lifecycle
 * (create -> release -> complete) with its accounting effect. All
 * exercised through real HTTP against real PostgreSQL, same standard as
 * every other phase.
 */
describe("Manufacturing: work centers, BOM, standard costs, production orders (e2e)", () => {
  let app: INestApplication;
  const adminDb = new PrismaClient();

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const adminEmail = `mfg.admin.${unique}@accora.test`;
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
      .send({
        companyName: "Manufacturing Test Co",
        baseCurrencyCode: "JOD",
        adminFullName: "Manufacturing Admin",
        adminEmail,
        adminPassword: password,
      })
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

  async function purchase(itemId: string, qty: string, unitCost: string) {
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

  it("creates a work center", async () => {
    const wc = await request(app.getHttpServer())
      .post("/manufacturing/work-centers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Assembly Line", costPerHour: "15.00" })
      .expect(201);
    expect(wc.body.name).toBe("Assembly Line");

    const list = await request(app.getHttpServer())
      .get("/manufacturing/work-centers")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.some((w: any) => w.id === wc.body.id)).toBe(true);
  });

  it("creates a BOM and a new version deactivates the previous one", async () => {
    const raw = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `RM-BOM-${unique}`, name: "Steel Rod", baseUnitId: unitId, itemType: "RAW_MATERIAL" })
      .expect(201);
    const finished = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `FG-BOM-${unique}`, name: "Steel Chair", baseUnitId: unitId, itemType: "FINISHED_GOOD" })
      .expect(201);

    const bomV1 = await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, lines: [{ componentItemId: raw.body.id, qty: "2", unitId }] })
      .expect(201);
    expect(bomV1.body.version).toBe(1);
    expect(bomV1.body.isActive).toBe(true);

    const bomV2 = await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, lines: [{ componentItemId: raw.body.id, qty: "3", unitId }] })
      .expect(201);
    expect(bomV2.body.version).toBe(2);
    expect(bomV2.body.isActive).toBe(true);

    const v1AfterV2 = await request(app.getHttpServer())
      .get(`/manufacturing/boms/${bomV1.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(v1AfterV2.body.isActive).toBe(false);

    // A BOM producing anything other than SEMI_FINISHED/FINISHED_GOOD is rejected.
    const trading = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `TRD-BOM-${unique}`, name: "Resale Widget", baseUnitId: unitId, itemType: "TRADING" })
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: trading.body.id, lines: [{ componentItemId: raw.body.id, qty: "1", unitId }] })
      .expect(400);
    expect(rejected.body.message).toMatch(/SEMI_FINISHED or FINISHED_GOOD/);
  });

  it("sets a standard cost for an item and reads it back", async () => {
    const item = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `FG-SC-${unique}`, name: "Standard-Costed Widget", baseUnitId: unitId, itemType: "FINISHED_GOOD" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/manufacturing/standard-costs")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: item.body.id, materialCost: "8.0000", laborCost: "2.0000", overheadCost: "1.0000", effectiveDate: today })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/manufacturing/standard-costs?itemId=${item.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].materialCost).toBe("8");

    const negative = await request(app.getHttpServer())
      .post("/manufacturing/standard-costs")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: item.body.id, materialCost: "-1", laborCost: "0", overheadCost: "0", effectiveDate: today })
      .expect(400);
    expect(negative.body.message).toMatch(/cannot be negative/);
  });

  it("production order: release consumes raw material at its actual cost, complete produces the finished good and posts one balanced journal entry", async () => {
    const raw = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `RM-PO-${unique}`, name: "Aluminum Sheet", baseUnitId: unitId, itemType: "RAW_MATERIAL" })
      .expect(201);
    const rawId = raw.body.id;
    const finished = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `FG-PO-${unique}`, name: "Aluminum Case", baseUnitId: unitId, itemType: "FINISHED_GOOD" })
      .expect(201);
    const finishedId = finished.body.id;

    // 2 raw units per finished unit, +10% scrap.
    await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finishedId, lines: [{ componentItemId: rawId, qty: "2", unitId, scrapPercent: "10" }] })
      .expect(201);

    // plannedQty 5 -> raw material needed = 2 * 5 * 1.10 = 11.0000
    await purchase(rawId, "20", "4.00"); // enough stock at a known unit cost

    const order = await request(app.getHttpServer())
      .post("/manufacturing/production-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finishedId, plannedQty: "5", warehouseId, startDate: today })
      .expect(201);
    expect(order.body.status).toBe("DRAFT");
    expect(order.body.orderNumber).toMatch(/^MO-/);

    const released = await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/release`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(released.body.status).toBe("IN_PROGRESS");
    expect(released.body.materialConsumptions).toHaveLength(1);
    expect(released.body.materialConsumptions[0].qty).toBe("11");
    expect(released.body.materialConsumptions[0].unitCost).toBe("4");

    // 9 units of raw material remain in stock (20 - 11).
    const rawBalance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId: rawId, warehouseId } },
    });
    expect(rawBalance.qtyOnHand.toFixed(4)).toBe("9.0000");

    const completed = await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ laborCost: "10.00", overheadCost: "6.00" })
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.postedJournalEntryId).toBeTruthy();
    // total cost = 11*4 (material) + 10 (labor) + 6 (overhead) = 60, / 5 units = 12.00
    expect(completed.body.outputs).toHaveLength(1);
    expect(completed.body.outputs[0].qty).toBe("5");
    expect(completed.body.outputs[0].unitCost).toBe("12");

    const finishedBalance = await adminDb.stockBalance.findUniqueOrThrow({
      where: { itemId_warehouseId: { itemId: finishedId, warehouseId } },
    });
    expect(finishedBalance.qtyOnHand.toFixed(4)).toBe("5.0000");

    const je = await adminDb.journalEntry.findUniqueOrThrow({
      where: { id: completed.body.postedJournalEntryId },
      include: { lines: { include: { account: true } } },
    });
    const fgLine = je.lines.find((l) => l.account.code === "1143"); // Finished Goods Inventory
    const rmLine = je.lines.find((l) => l.account.code === "1141"); // Raw Materials Inventory
    const laborLine = je.lines.find((l) => l.account.code === "5200"); // Direct Labor
    const overheadLine = je.lines.find((l) => l.account.code === "5330"); // Factory Overhead Applied
    expect(fgLine?.debit.toFixed(4)).toBe("60.0000");
    expect(rmLine?.credit.toFixed(4)).toBe("44.0000");
    expect(laborLine?.credit.toFixed(4)).toBe("10.0000");
    expect(overheadLine?.credit.toFixed(4)).toBe("6.0000");

    // A DRAFT-only action can't be repeated once released.
    const reRelease = await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/release`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(reRelease.body.message).toMatch(/already/i);
  });

  it("release rejects a production order that needs more raw material than is in stock", async () => {
    const raw = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `RM-SHORT-${unique}`, name: "Scarce Material", baseUnitId: unitId, itemType: "RAW_MATERIAL" })
      .expect(201);
    const finished = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `FG-SHORT-${unique}`, name: "Scarce Product", baseUnitId: unitId, itemType: "FINISHED_GOOD" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, lines: [{ componentItemId: raw.body.id, qty: "1", unitId }] })
      .expect(201);

    await purchase(raw.body.id, "2", "1.00"); // only 2 in stock

    const order = await request(app.getHttpServer())
      .post("/manufacturing/production-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, plannedQty: "10", warehouseId })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/release`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(rejected.body.message).toMatch(/Insufficient stock/);

    const stillDraft = await request(app.getHttpServer())
      .get(`/manufacturing/production-orders/${order.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(stillDraft.body.status).toBe("DRAFT");
  });

  it("complete records cost variance against a standard cost when one is set for the item", async () => {
    const raw = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `RM-VAR-${unique}`, name: "Variance Material", baseUnitId: unitId, itemType: "RAW_MATERIAL" })
      .expect(201);
    const finished = await request(app.getHttpServer())
      .post("/catalog/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `FG-VAR-${unique}`, name: "Variance Product", baseUnitId: unitId, itemType: "FINISHED_GOOD" })
      .expect(201);

    // Standard: material 8.00, labor 2.00, overhead 1.00 per unit (total 11.00/unit).
    await request(app.getHttpServer())
      .post("/manufacturing/standard-costs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemId: finished.body.id,
        materialCost: "8.0000",
        laborCost: "2.0000",
        overheadCost: "1.0000",
        effectiveDate: today,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/manufacturing/boms")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, lines: [{ componentItemId: raw.body.id, qty: "1", unitId }] })
      .expect(201);

    // Actual material cost per unit will be 10.00 (bought at 10.00/unit) -> unfavorable material variance.
    await purchase(raw.body.id, "5", "10.00");

    const order = await request(app.getHttpServer())
      .post("/manufacturing/production-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemId: finished.body.id, plannedQty: "2", warehouseId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/release`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);

    // Actual labor 3.00/unit (6.00 total, standard 4.00) and overhead 1.00/unit (2.00 total, matches standard).
    const completed = await request(app.getHttpServer())
      .post(`/manufacturing/production-orders/${order.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ laborCost: "6.00", overheadCost: "2.00" })
      .expect(201);

    const variances = completed.body.costVariances;
    expect(variances).toHaveLength(3);
    // actual material 20.00 (2 units * 10.00) - standard 16.00 (2 * 8.00) = +4.00 unfavorable
    expect(variances.find((v: any) => v.type === "MATERIAL").amount).toBe("4");
    // actual labor 6.00 - standard 4.00 (2*2.00) = +2.00 unfavorable
    expect(variances.find((v: any) => v.type === "LABOR").amount).toBe("2");
    // actual overhead 2.00 - standard 2.00 (2*1.00) = 0
    expect(variances.find((v: any) => v.type === "OVERHEAD").amount).toBe("0");
  });
});
