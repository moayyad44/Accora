import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { FixedAssetStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FixedAssetsService } from "./fixed-assets.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RegisterFixedAssetDto } from "./dto/register-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";

@Controller("fixed-assets/assets")
export class FixedAssetsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixedAssetsService: FixedAssetsService,
  ) {}

  @Get()
  @RequirePermission("fixed_assets", "fixed_asset", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: FixedAssetStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fixedAssetsService.list(tx, companyId, status),
    );
  }

  @Get(":id")
  @RequirePermission("fixed_assets", "fixed_asset", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fixedAssetsService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("fixed_assets", "fixed_asset", "create")
  register(@CurrentUser() user: AccessTokenPayload, @Body() dto: RegisterFixedAssetDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fixedAssetsService.register(tx, companyId, user.sub, {
        categoryId: dto.categoryId,
        name: dto.name,
        nameAr: dto.nameAr,
        purchaseDate: new Date(dto.purchaseDate),
        usageStartDate: dto.usageStartDate ? new Date(dto.usageStartDate) : undefined,
        cost: dto.cost,
        salvageValue: dto.salvageValue,
        usefulLifeMonths: dto.usefulLifeMonths,
        depreciationMethod: dto.depreciationMethod,
        fundingAccountId: dto.fundingAccountId,
      }),
    );
  }

  @Post(":id/dispose")
  @RequirePermission("fixed_assets", "fixed_asset", "post")
  dispose(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: DisposeFixedAssetDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.fixedAssetsService.dispose(tx, companyId, user.sub, id, {
        disposalDate: new Date(dto.disposalDate),
        proceeds: dto.proceeds,
        proceedsAccountId: dto.proceedsAccountId,
        notes: dto.notes,
      }),
    );
  }
}
