import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockCountsService } from "./stock-counts.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateStockCountDto } from "./dto/create-stock-count.dto";
import { SetCountedQuantitiesDto } from "./dto/set-counted-quantities.dto";

@Controller("inventory/stock-counts")
export class StockCountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockCountsService: StockCountsService,
  ) {}

  @Get()
  @RequirePermission("inventory", "stock_count", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockCountsService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("inventory", "stock_count", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockCountsService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("inventory", "stock_count", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateStockCountDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockCountsService.create(tx, companyId, {
        warehouseId: dto.warehouseId,
        type: dto.type,
        countDate: new Date(dto.countDate),
        itemIds: dto.itemIds,
      }),
    );
  }

  @Patch(":id/counted-quantities")
  @RequirePermission("inventory", "stock_count", "update")
  setCountedQuantities(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body() dto: SetCountedQuantitiesDto,
  ) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockCountsService.setCountedQuantities(tx, companyId, id, dto.lines),
    );
  }

  @Post(":id/post")
  @RequirePermission("inventory", "stock_count", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockCountsService.post(tx, companyId, user.sub, id),
    );
  }
}
