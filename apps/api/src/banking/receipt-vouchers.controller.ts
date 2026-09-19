import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReceiptVouchersService } from "./receipt-vouchers.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateReceiptVoucherDto } from "./dto/create-receipt-voucher.dto";

@Controller("banking/receipt-vouchers")
export class ReceiptVouchersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptVouchersService: ReceiptVouchersService,
  ) {}

  @Get()
  @RequirePermission("banking", "receipt_voucher", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.receiptVouchersService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("banking", "receipt_voucher", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.receiptVouchersService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("banking", "receipt_voucher", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateReceiptVoucherDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.receiptVouchersService.create(tx, companyId, {
        cashBankAccountId: dto.cashBankAccountId,
        voucherDate: new Date(dto.voucherDate),
        branchId: dto.branchId,
        partyType: dto.partyType,
        customerId: dto.customerId,
        supplierId: dto.supplierId,
        otherAccountId: dto.otherAccountId,
        salesInvoiceId: dto.salesInvoiceId,
        amount: dto.amount,
        description: dto.description,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("banking", "receipt_voucher", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.receiptVouchersService.post(tx, companyId, user.sub, id),
    );
  }
}
