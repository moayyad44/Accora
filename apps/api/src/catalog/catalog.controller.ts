import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "./catalog.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateItemDto } from "./dto/create-item.dto";

@Controller("catalog/units")
export class UnitsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @RequirePermission("inventory", "item", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.catalogService.listUnits(tx, companyId));
  }

  @Post()
  @RequirePermission("inventory", "item", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateUnitDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.catalogService.createUnit(tx, companyId, dto),
    );
  }
}

@Controller("catalog/categories")
export class CategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @RequirePermission("inventory", "item", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.catalogService.listCategories(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("inventory", "item", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateCategoryDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.catalogService.createCategory(tx, companyId, dto),
    );
  }
}

@Controller("catalog/items")
export class ItemsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @RequirePermission("inventory", "item", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.catalogService.listItems(tx, companyId));
  }

  @Get("by-barcode/:barcode")
  @RequirePermission("inventory", "item", "view")
  findByBarcode(@CurrentUser() user: AccessTokenPayload, @Param("barcode") barcode: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.catalogService.findByBarcode(tx, companyId, barcode),
    );
  }

  @Post()
  @RequirePermission("inventory", "item", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateItemDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.catalogService.createItem(tx, companyId, dto),
    );
  }
}
