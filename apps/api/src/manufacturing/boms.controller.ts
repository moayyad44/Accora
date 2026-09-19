import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BomsService } from "./boms.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateBomDto } from "./dto/create-bom.dto";

@Controller("manufacturing/boms")
export class BomsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bomsService: BomsService,
  ) {}

  @Get()
  @RequirePermission("manufacturing", "bom", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("itemId") itemId?: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.bomsService.list(tx, companyId, itemId),
    );
  }

  @Get(":id")
  @RequirePermission("manufacturing", "bom", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.bomsService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("manufacturing", "bom", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateBomDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.bomsService.create(tx, companyId, dto),
    );
  }
}
