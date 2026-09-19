import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AssetCategoriesService } from "./asset-categories.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateAssetCategoryDto } from "./dto/create-asset-category.dto";

@Controller("fixed-assets/categories")
export class AssetCategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetCategoriesService: AssetCategoriesService,
  ) {}

  @Get()
  @RequirePermission("fixed_assets", "asset_category", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.assetCategoriesService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("fixed_assets", "asset_category", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.assetCategoriesService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("fixed_assets", "asset_category", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateAssetCategoryDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.assetCategoriesService.create(tx, companyId, dto),
    );
  }
}
