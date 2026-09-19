-- AlterTable
ALTER TABLE "purchase_invoice_lines" ADD COLUMN     "serialNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "sales_invoice_lines" ADD COLUMN     "serialNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
