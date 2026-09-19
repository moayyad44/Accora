import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WarehousesService } from "./warehouses.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";

@Controller("inventory/warehouses")
export class WarehousesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehousesService: WarehousesService,
  ) {}

  @Get()
  @RequirePermission("inventory", "warehouse", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.warehousesService.list(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("inventory", "warehouse", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateWarehouseDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.warehousesService.create(tx, companyId, dto),
    );
  }
}
