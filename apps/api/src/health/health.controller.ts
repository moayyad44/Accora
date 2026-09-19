import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators/public.decorator";

/**
 * Liveness/readiness probe for orchestrators (Docker healthcheck, a load
 * balancer, etc.) — deliberately outside JWT/tenant scoping (it runs before
 * any company or user context exists) and does not touch RLS-protected
 * tables, only proves the app process is up and can reach Postgres.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException("Database unreachable");
    }
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
