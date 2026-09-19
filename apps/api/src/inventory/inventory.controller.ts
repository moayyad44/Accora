import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "./inventory.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { TransferStockDto } from "./dto/transfer-stock.dto";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { StockAdjustmentsService } from "./stock-adjustments.service";
import { SerialTrackingService } from "./serial-tracking.service";

@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly stockAdjustmentsService: StockAdjustmentsService,
    private readonly serialTrackingService: SerialTrackingService,
  ) {}

  @Get("stock-balances")
  @RequirePermission("inventory", "item", "view")
  balances(@CurrentUser() user: AccessTokenPayload, @Query("warehouseId") warehouseId?: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.inventoryService.getBalances(tx, companyId, warehouseId),
    );
  }

  @Get("items/:itemId/card")
  @RequirePermission("inventory", "item", "view")
  itemCard(
    @CurrentUser() user: AccessTokenPayload,
    @Param("itemId") itemId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.inventoryService.getItemCard(tx, companyId, itemId, warehouseId),
    );
  }

  @Post("transfers")
  @RequirePermission("inventory", "stock_transfer", "create")
  transfer(@CurrentUser() user: AccessTokenPayload, @Body() dto: TransferStockDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.inventoryService.transferStock(tx, companyId, dto.itemId, dto.fromWarehouseId, dto.toWarehouseId, dto.qty),
    );
  }

  @Post("adjustments")
  @RequirePermission("inventory", "stock_adjustment", "create")
  adjust(@CurrentUser() user: AccessTokenPayload, @Body() dto: AdjustStockDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.stockAdjustmentsService.adjust(tx, companyId, user.sub, {
        ...dto,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      }),
    );
  }

  @Get("items/:itemId/batches")
  @RequirePermission("inventory", "item", "view")
  batches(@CurrentUser() user: AccessTokenPayload, @Param("itemId") itemId: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.inventoryService.getBatches(tx, companyId, itemId),
    );
  }

  @Get("expiring-batches")
  @RequirePermission("inventory", "item", "view")
  expiringBatches(@CurrentUser() user: AccessTokenPayload, @Query("withinDays") withinDays?: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.inventoryService.getExpiringBatches(tx, companyId, withinDays ? Number(withinDays) : 30),
    );
  }

  @Get("items/:itemId/serials")
  @RequirePermission("inventory", "item", "view")
  serialsInStock(
    @CurrentUser() user: AccessTokenPayload,
    @Param("itemId") itemId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.serialTrackingService.listInStock(tx, companyId, itemId, warehouseId),
    );
  }
}
