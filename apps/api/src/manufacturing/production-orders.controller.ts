import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ProductionOrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProductionOrdersService } from "./production-orders.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateProductionOrderDto } from "./dto/create-production-order.dto";
import { ReleaseProductionOrderDto } from "./dto/release-production-order.dto";
import { CompleteProductionOrderDto } from "./dto/complete-production-order.dto";

@Controller("manufacturing/production-orders")
export class ProductionOrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productionOrdersService: ProductionOrdersService,
  ) {}

  @Get()
  @RequirePermission("manufacturing", "production_order", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: ProductionOrderStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.productionOrdersService.list(tx, companyId, status),
    );
  }

  @Get(":id")
  @RequirePermission("manufacturing", "production_order", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.productionOrdersService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("manufacturing", "production_order", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateProductionOrderDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.productionOrdersService.create(tx, companyId, {
        itemId: dto.itemId,
        plannedQty: dto.plannedQty,
        warehouseId: dto.warehouseId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      }),
    );
  }

  @Post(":id/release")
  @RequirePermission("manufacturing", "production_order", "post")
  release(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: ReleaseProductionOrderDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.productionOrdersService.release(tx, companyId, id, dto),
    );
  }

  @Post(":id/complete")
  @RequirePermission("manufacturing", "production_order", "post")
  complete(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: CompleteProductionOrderDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.productionOrdersService.complete(tx, companyId, user.sub, id, {
        actualQty: dto.actualQty,
        laborCost: dto.laborCost,
        overheadCost: dto.overheadCost,
        outputSerialNumbers: dto.outputSerialNumbers,
        outputBatch: dto.outputBatch
          ? {
              batchNumber: dto.outputBatch.batchNumber,
              expiryDate: dto.outputBatch.expiryDate ? new Date(dto.outputBatch.expiryDate) : undefined,
              manufactureDate: dto.outputBatch.manufactureDate ? new Date(dto.outputBatch.manufactureDate) : undefined,
            }
          : undefined,
      }),
    );
  }
}
