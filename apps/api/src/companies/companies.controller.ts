import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CompaniesService } from "./companies.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";

@Controller("companies")
export class CompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  /** Every company the caller can switch into. No @RequirePermission — this
   * is identity-scoped (it's always "my own" companies), not permission-gated. */
  @Get()
  async listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.prisma.withTenant({ companyId: null, userId: user.sub }, (tx) =>
      this.companiesService.listMyCompanies(tx, user.sub),
    );
  }
}
