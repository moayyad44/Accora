-- CreateEnum
CREATE TYPE "CashBankAccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "VoucherPartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "cash_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "CashBankAccountType" NOT NULL,
    "accountId" UUID NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" DATE NOT NULL,
    "cashBankAccountId" UUID NOT NULL,
    "partyType" "VoucherPartyType" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "otherAccountId" UUID,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" DATE NOT NULL,
    "cashBankAccountId" UUID NOT NULL,
    "partyType" "VoucherPartyType" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "otherAccountId" UUID,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "transferDate" DATE NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "cashBankAccountId" UUID NOT NULL,
    "statementDate" DATE NOT NULL,
    "statementBalance" DECIMAL(18,4) NOT NULL,
    "bookBalance" DECIMAL(18,4) NOT NULL,
    "difference" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_bank_accounts_companyId_name_key" ON "cash_bank_accounts"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_vouchers_companyId_voucherNumber_key" ON "receipt_vouchers"("companyId", "voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payment_vouchers_companyId_voucherNumber_key" ON "payment_vouchers"("companyId", "voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transfers_companyId_transferNumber_key" ON "bank_transfers"("companyId", "transferNumber");

-- AddForeignKey
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_otherAccountId_fkey" FOREIGN KEY ("otherAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_otherAccountId_fkey" FOREIGN KEY ("otherAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-level security for the new Banks & Cash tables (Phase 10) — all five
-- carry companyId directly, so this is the standard direct-companyId
-- policy (docs/DATABASE.md §3.1), same shape as every other tenant-scoped
-- table added since the original RLS migration.
-- ============================================================================

DO $$
DECLARE
  t text;
  banking_tables text[] := ARRAY[
    'cash_bank_accounts', 'receipt_vouchers', 'payment_vouchers',
    'bank_transfers', 'bank_reconciliations'
  ];
BEGIN
  FOREACH t IN ARRAY banking_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("companyId" = NULLIF(current_setting(''app.current_company_id'', true), '''')::uuid)
         WITH CHECK ("companyId" = NULLIF(current_setting(''app.current_company_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;
