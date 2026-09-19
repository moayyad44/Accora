import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PurchaseInvoicesService } from "./purchase-invoices.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreatePurchaseInvoiceDto } from "./dto/create-purchase-invoice.dto";

@Controller("purchasing/invoices")
export class PurchaseInvoicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseInvoicesService: PurchaseInvoicesService,
  ) {}

  @Get()
  @RequirePermission("purchasing", "purchase_invoice", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.purchaseInvoicesService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("purchasing", "purchase_invoice", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.purchaseInvoicesService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("purchasing", "purchase_invoice", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePurchaseInvoiceDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.purchaseInvoicesService.create(tx, companyId, {
        supplierId: dto.supplierId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        branchId: dto.branchId,
        lines: dto.lines,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("purchasing", "purchase_invoice", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.purchaseInvoicesService.post(tx, companyId, user.sub, id),
    );
  }
}
