import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PartiesService } from "./parties.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";

@Controller("customers")
export class CustomersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partiesService: PartiesService,
  ) {}

  @Get()
  @RequirePermission("sales", "customer", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.partiesService.listCustomers(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("sales", "customer", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateCustomerDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.partiesService.createCustomer(tx, companyId, dto),
    );
  }
}

@Controller("suppliers")
export class SuppliersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partiesService: PartiesService,
  ) {}

  @Get()
  @RequirePermission("purchasing", "supplier", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.partiesService.listSuppliers(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("purchasing", "supplier", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateSupplierDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.partiesService.createSupplier(tx, companyId, dto),
    );
  }
}
