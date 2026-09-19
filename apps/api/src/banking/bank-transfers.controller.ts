import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BankTransfersService } from "./bank-transfers.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateBankTransferDto } from "./dto/create-bank-transfer.dto";

@Controller("banking/transfers")
export class BankTransfersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankTransfersService: BankTransfersService,
  ) {}

  @Get()
  @RequirePermission("banking", "bank_transfer", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.bankTransfersService.list(tx, companyId));
  }

  @Get(":id")
  @RequirePermission("banking", "bank_transfer", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.bankTransfersService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("banking", "bank_transfer", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateBankTransferDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.bankTransfersService.create(tx, companyId, {
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        transferDate: new Date(dto.transferDate),
        amount: dto.amount,
        description: dto.description,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("banking", "bank_transfer", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.bankTransfersService.post(tx, companyId, user.sub, id),
    );
  }
}
