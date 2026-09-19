import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SalesInvoicesService } from "./sales-invoices.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateSalesInvoiceDto } from "./dto/create-sales-invoice.dto";

@Controller("sales/invoices")
export class SalesInvoicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesInvoicesService: SalesInvoicesService,
  ) {}

  @Get()
  @RequirePermission("sales", "sales_invoice", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.salesInvoicesService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("sales", "sales_invoice", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.salesInvoicesService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("sales", "sales_invoice", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateSalesInvoiceDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.salesInvoicesService.create(tx, companyId, {
        customerId: dto.customerId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        kind: dto.kind,
        branchId: dto.branchId,
        lines: dto.lines,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("sales", "sales_invoice", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.salesInvoicesService.post(tx, companyId, user.sub, id),
    );
  }
}
