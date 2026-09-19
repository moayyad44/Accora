import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

export interface TenantContext {
  /** Active company for this request, or null when no company is selected yet
   * (e.g. during login, or while a brand-new company is being created). */
  companyId: string | null;
  /** The authenticated user, or null for unauthenticated requests. Needed so
   * a user can always see their OWN user_company_access rows regardless of
   * which company is currently active (see the refine_user_company_access_rls
   * migration) — that's how "list my companies" / login work before any
   * single company has been chosen. */
  userId: string | null;
  isSuperAdmin?: boolean;
}

/**
 * The application connects to Postgres as `app_user`, the least-privilege
 * role the RLS policies actually restrict (see prisma/migrations/
 * ..._add_row_level_security). This is deliberate: the `DATABASE_URL` owner
 * account used for migrations is a Postgres superuser and silently bypasses
 * Row-Level Security, so using it at runtime would make the whole isolation
 * guarantee meaningless. RUNTIME_DATABASE_URL must point at app_user.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: process.env.RUNTIME_DATABASE_URL },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Opens a single DB transaction with the tenant session variables set
   * (SET LOCAL semantics via set_config(..., true), i.e. scoped to this
   * transaction only), then runs `fn` with the transaction client. Every
   * PostgreSQL Row-Level Security policy in the schema reads these
   * variables — this is the ONE place in the codebase that is allowed to
   * decide "which company/user is this request acting as", so every
   * request-handling code path must go through it rather than touching
   * `this` (the raw PrismaClient) directly.
   */
  async withTenant<T>(ctx: TenantContext, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_company_id', $1, true), set_config('app.current_user_id', $2, true), set_config('app.is_super_admin', $3, true)`,
        ctx.companyId ?? "",
        ctx.userId ?? "",
        ctx.isSuperAdmin ? "true" : "false",
      );
      return fn(tx);
    });
  }

  /** Re-points the session variables mid-transaction, e.g. once login has
   * identified which user is authenticating (see AuthService.login). */
  async setSessionContext(tx: Prisma.TransactionClient, ctx: TenantContext) {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_company_id', $1, true), set_config('app.current_user_id', $2, true), set_config('app.is_super_admin', $3, true)`,
      ctx.companyId ?? "",
      ctx.userId ?? "",
      ctx.isSuperAdmin ? "true" : "false",
    );
  }
}
