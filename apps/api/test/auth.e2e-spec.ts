import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Phase 3 acceptance tests — run against a real (local) Postgres instance,
 * exactly as the app would run in production. These exist to prove, through
 * real HTTP requests (not by inspecting code), the Phase 3 promises:
 *   1. A brand-new company gets its own chart of accounts + roles.
 *   2. A user only ever sees companies/users/roles for a company they were
 *      actually granted access to (multi-tenant isolation, enforced by the
 *      app layer AND by PostgreSQL RLS underneath it).
 *   3. A role without a permission is denied that action (RBAC).
 */
describe("Auth / Companies / Users / Roles (e2e)", () => {
  let app: INestApplication;
  // Bypasses RLS (connects as the migration owner) — used ONLY to set up
  // fixtures the API has no endpoint for yet (assigning a specific role to
  // a second user), never to assert on isolation itself.
  const adminDb = new PrismaClient();

  const unique = Date.now();
  const companyAEmail = `admin.a.${unique}@accora.test`;
  const companyBEmail = `admin.b.${unique}@accora.test`;
  const salesUserEmail = `sales.${unique}@accora.test`;
  const password = "SuperSecret123!";

  let companyAId: string;
  let companyAToken: string;
  let companyBId: string;
  let companyBToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await adminDb.$disconnect();
    await app.close();
  });

  it("registers Company A with its own admin, cloning the default chart of accounts and roles", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Company A Furniture Factory",
        baseCurrencyCode: "JOD",
        adminFullName: "Admin A",
        adminEmail: companyAEmail,
        adminPassword: password,
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.companyId).toBeDefined();
    companyAId = res.body.companyId;
    companyAToken = res.body.accessToken;

    const accounts = await adminDb.account.findMany({ where: { companyId: companyAId } });
    expect(accounts.length).toBe(58); // matches DEFAULT_COA in prisma/seed.ts

    const roles = await adminDb.role.findMany({ where: { companyId: companyAId } });
    expect(roles.length).toBe(10); // matches ROLE_TEMPLATES in prisma/seed.ts

    const adminRole = roles.find((r) => r.name === "Company Admin");
    const access = await adminDb.userCompanyAccess.findFirst({ where: { companyId: companyAId } });
    expect(access?.roleId).toBe(adminRole?.id);
  });

  it("registers Company B with a different admin, completely independent of Company A", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Company B Trading",
        baseCurrencyCode: "JOD",
        adminFullName: "Admin B",
        adminEmail: companyBEmail,
        adminPassword: password,
      })
      .expect(201);

    companyBId = res.body.companyId;
    companyBToken = res.body.accessToken;
    expect(companyBId).not.toBe(companyAId);

    const accountsB = await adminDb.account.count({ where: { companyId: companyBId } });
    expect(accountsB).toBe(58);
  });

  it("rejects registering the same admin email twice", async () => {
    await request(app.getHttpServer())
      .post("/auth/register-company")
      .send({
        companyName: "Duplicate Co",
        baseCurrencyCode: "JOD",
        adminFullName: "Dup",
        adminEmail: companyAEmail,
        adminPassword: password,
      })
      .expect(400);
  });

  it("logs Admin A in and returns exactly the companies they belong to", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: companyAEmail, password })
      .expect(201);

    expect(res.body.companies).toHaveLength(1);
    expect(res.body.companies[0].companyId).toBe(companyAId);
    // Company B must never appear for Admin A, even though it exists in the
    // same database — this is the multi-tenant isolation guarantee, hit
    // through the real login endpoint rather than raw SQL.
    expect(res.body.companies.map((c: any) => c.companyId)).not.toContain(companyBId);
  });

  it("returns only Company A's roles when listing roles as Admin A (never Company B's)", async () => {
    const res = await request(app.getHttpServer())
      .get("/roles")
      .set("Authorization", `Bearer ${companyAToken}`)
      .expect(200);

    expect(res.body).toHaveLength(10);
    const companyBRoleIds = (await adminDb.role.findMany({ where: { companyId: companyBId } })).map((r) => r.id);
    for (const role of res.body) {
      expect(companyBRoleIds).not.toContain(role.id);
    }
  });

  it("returns only Company A's users when listing users as Admin A", async () => {
    const res = await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${companyAToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe(companyAEmail);
  });

  it("blocks Admin A from switching into Company B, which they have no access to", async () => {
    await request(app.getHttpServer())
      .post("/auth/switch-company")
      .set("Authorization", `Bearer ${companyAToken}`)
      .send({ companyId: companyBId })
      .expect(403);
  });

  it("rejects any request without a token", async () => {
    await request(app.getHttpServer()).get("/users/me").expect(401);
  });

  it("rejects a request with a token signed for a different secret (forged token)", async () => {
    const forged = jwt.sign({ sub: "x", email: "x@x.com", companyId: companyAId, roleId: "x", isSuperAdmin: true }, "wrong-secret");
    await request(app.getHttpServer()).get("/users/me").set("Authorization", `Bearer ${forged}`).expect(401);
  });

  it("denies an action the caller's role does not have permission for (RBAC)", async () => {
    // No "invite user" endpoint exists yet in Phase 3, so this fixture is
    // built directly against the DB (bypassing RLS as the owner) purely to
    // set up "a real user holding the Sales role in Company A" — the guard
    // itself is then exercised through the real HTTP endpoint below.
    const salesRole = await adminDb.role.findFirstOrThrow({ where: { companyId: companyAId, name: "Sales" } });
    const salesUser = await adminDb.user.create({
      data: { email: salesUserEmail, passwordHash: await bcrypt.hash(password, 12), fullName: "Sales Rep" },
    });
    await adminDb.userCompanyAccess.create({
      data: { userId: salesUser.id, companyId: companyAId, roleId: salesRole.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: salesUserEmail, password })
      .expect(201);
    const salesToken = loginRes.body.accessToken;

    // Sales role has no core.user.view permission -> must be forbidden.
    await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${salesToken}`)
      .expect(403);

    // Meanwhile Company Admin (full permissions) can still do it.
    await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${companyAToken}`)
      .expect(200);
  });
});
