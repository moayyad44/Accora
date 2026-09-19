import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TaxTypesService } from "./tax-types.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateTaxTypeDto } from "./dto/create-tax-type.dto";

@Controller("tax/types")
export class TaxTypesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxTypesService: TaxTypesService,
  ) {}

  @Get()
  @RequirePermission("tax", "tax_type", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.taxTypesService.list(tx, companyId));
  }

  @Get(":id")
  @RequirePermission("tax", "tax_type", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.taxTypesService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("tax", "tax_type", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaxTypeDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.taxTypesService.create(tx, companyId, dto),
    );
  }
}
