import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { CashBankAccountsService } from "./cash-bank-accounts.service";
import { CashBankAccountsController } from "./cash-bank-accounts.controller";
import { ReceiptVouchersService } from "./receipt-vouchers.service";
import { ReceiptVouchersController } from "./receipt-vouchers.controller";
import { PaymentVouchersService } from "./payment-vouchers.service";
import { PaymentVouchersController } from "./payment-vouchers.controller";
import { BankTransfersService } from "./bank-transfers.service";
import { BankTransfersController } from "./bank-transfers.controller";
import { ReconciliationService } from "./reconciliation.service";
import { ReconciliationController } from "./reconciliation.controller";

@Module({
  imports: [AccountingModule],
  providers: [
    CashBankAccountsService,
    ReceiptVouchersService,
    PaymentVouchersService,
    BankTransfersService,
    ReconciliationService,
  ],
  controllers: [
    CashBankAccountsController,
    ReceiptVouchersController,
    PaymentVouchersController,
    BankTransfersController,
    ReconciliationController,
  ],
  exports: [CashBankAccountsService],
})
export class BankingModule {}
