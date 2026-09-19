-- AlterTable
ALTER TABLE "purchase_invoice_lines" ADD COLUMN     "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_invoice_line_taxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseInvoiceLineId" UUID NOT NULL,
    "taxRateId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_invoice_line_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_line_taxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "salesInvoiceLineId" UUID NOT NULL,
    "taxRateId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "sales_invoice_line_taxes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "purchase_invoice_line_taxes" ADD CONSTRAINT "purchase_invoice_line_taxes_purchaseInvoiceLineId_fkey" FOREIGN KEY ("purchaseInvoiceLineId") REFERENCES "purchase_invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_line_taxes" ADD CONSTRAINT "purchase_invoice_line_taxes_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line_taxes" ADD CONSTRAINT "sales_invoice_line_taxes_salesInvoiceLineId_fkey" FOREIGN KEY ("salesInvoiceLineId") REFERENCES "sales_invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line_taxes" ADD CONSTRAINT "sales_invoice_line_taxes_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-level security for the two new per-line tax breakdown tables. Neither
-- carries a companyId directly (only *InvoiceLineId), and their own parent
-- line table doesn't carry companyId either — it's two hops back to the
-- actual tenant-scoped row (sales_invoices / purchase_invoices), so the
-- policy joins through both, same principle as every other join-based
-- policy in this system (docs/DATABASE.md §3), just one hop deeper.
-- ============================================================================

ALTER TABLE sales_invoice_line_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_line_taxes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_invoice_line_taxes
  USING (EXISTS (
    SELECT 1 FROM sales_invoice_lines sil
    JOIN sales_invoices si ON si.id = sil."salesInvoiceId"
    WHERE sil.id = sales_invoice_line_taxes."salesInvoiceLineId"
      AND si."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE purchase_invoice_line_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_line_taxes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_invoice_line_taxes
  USING (EXISTS (
    SELECT 1 FROM purchase_invoice_lines pil
    JOIN purchase_invoices pi ON pi.id = pil."purchaseInvoiceId"
    WHERE pil.id = purchase_invoice_line_taxes."purchaseInvoiceLineId"
      AND pi."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));
