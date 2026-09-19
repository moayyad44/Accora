import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentVouchersService } from "./payment-vouchers.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreatePaymentVoucherDto } from "./dto/create-payment-voucher.dto";

@Controller("banking/payment-vouchers")
export class PaymentVouchersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentVouchersService: PaymentVouchersService,
  ) {}

  @Get()
  @RequirePermission("banking", "payment_voucher", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.paymentVouchersService.list(tx, companyId),
    );
  }

  @Get(":id")
  @RequirePermission("banking", "payment_voucher", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.paymentVouchersService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("banking", "payment_voucher", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePaymentVoucherDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.paymentVouchersService.create(tx, companyId, {
        cashBankAccountId: dto.cashBankAccountId,
        voucherDate: new Date(dto.voucherDate),
        branchId: dto.branchId,
        partyType: dto.partyType,
        customerId: dto.customerId,
        supplierId: dto.supplierId,
        otherAccountId: dto.otherAccountId,
        purchaseInvoiceId: dto.purchaseInvoiceId,
        amount: dto.amount,
        description: dto.description,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("banking", "payment_voucher", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.paymentVouchersService.post(tx, companyId, user.sub, id),
    );
  }
}
