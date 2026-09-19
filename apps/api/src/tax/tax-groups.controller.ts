import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TaxGroupsService } from "./tax-groups.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateTaxGroupDto } from "./dto/create-tax-group.dto";

@Controller("tax/groups")
export class TaxGroupsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxGroupsService: TaxGroupsService,
  ) {}

  @Get()
  @RequirePermission("tax", "tax_group", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.taxGroupsService.list(tx, companyId));
  }

  @Get(":id")
  @RequirePermission("tax", "tax_group", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.taxGroupsService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("tax", "tax_group", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaxGroupDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.taxGroupsService.create(tx, companyId, dto),
    );
  }
}
