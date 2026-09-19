-- AlterTable
ALTER TABLE "payment_vouchers" ADD COLUMN     "purchaseInvoiceId" UUID;

-- AlterTable
ALTER TABLE "receipt_vouchers" ADD COLUMN     "salesInvoiceId" UUID;

-- AddForeignKey
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
