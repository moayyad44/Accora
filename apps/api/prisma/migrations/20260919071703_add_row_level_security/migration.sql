-- ============================================================================
-- ROW-LEVEL SECURITY (Phase 2 second layer of tenant isolation)
--
-- The application already scopes every query by companyId (Prisma
-- middleware). This migration adds an independent, database-enforced layer:
-- even a buggy or malicious query cannot read/write rows belonging to a
-- company other than the one set on the current session/transaction.
--
-- Mechanism: every request opens its DB transaction with
--   SELECT set_config('app.current_company_id', '<uuid>', true);
-- (the `true` makes it transaction-local). All policies below check rows
-- against that session variable. If it is unset, current_setting(...) with
-- the `missing_ok` flag returns NULL and every policy denies all rows —
-- i.e. the fail-closed default is "no company selected = no data".
--
-- NOTE ON COLUMN NAMES: Prisma (no per-field @map) creates columns with the
-- exact camelCase field name from schema.prisma, e.g. "companyId", not
-- company_id. All identifiers below are therefore double-quoted camelCase to
-- match what actually exists on disk (verified against \d output after
-- `prisma migrate dev`).
--
-- Scope of this migration (documented in docs/DATABASE.md §3):
--   1. Every table that carries "companyId" directly gets a row policy
--      comparing it to the session variable.
--   2. A handful of financially critical child tables that do NOT carry
--      companyId (journal_entry_lines, sales/purchase invoice lines,
--      payroll items, asset depreciation/transactions, stock count lines)
--      get a policy that joins back to their parent's companyId.
--   3. Pure line/junction tables not listed here are only ever fetched
--      through their already-scoped parent in application code, and are
--      protected by ON DELETE CASCADE + the parent's RLS policy; they are
--      an explicit, documented scope boundary for this phase rather than
--      an oversight.
--
-- The `app_user` application DB role (created below) is the only role the
-- API server connects as; RLS is force-enabled so even the table owner is
-- subject to it when connected as app_user.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'change_me_in_production';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ----------------------------------------------------------------------------
-- 1. Direct companyId tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'branches', 'company_settings', 'user_company_access', 'roles',
    'exchange_rates', 'fiscal_years', 'document_sequences', 'audit_logs',
    'attachments', 'notifications', 'approval_workflows', 'cost_centers',
    'accounts', 'account_mappings', 'journal_entries', 'recurring_entry_templates',
    'customers', 'customer_groups', 'suppliers', 'price_lists', 'quotations',
    'sales_orders', 'sales_invoices', 'sales_returns', 'purchase_requests',
    'purchase_rfqs', 'purchase_orders', 'goods_receipts', 'purchase_invoices',
    'purchase_returns', 'warehouses', 'item_categories', 'units_of_measure',
    'items', 'stock_moves', 'stock_balances', 'fifo_layers', 'stock_counts',
    'boms', 'work_centers', 'production_orders', 'cost_allocation_rules',
    'asset_categories', 'fixed_assets', 'departments', 'positions', 'employees',
    'payroll_runs', 'tax_types', 'tax_groups'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
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

-- audit_logs."companyId" is nullable (system-level actions have no company);
-- allow the super-admin path to see NULL-company rows only when no tenant
-- context is set, otherwise the row-level check above already applies.
ALTER POLICY tenant_isolation ON audit_logs
  USING (
    "companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR ("companyId" IS NULL AND current_setting('app.is_super_admin', true) = 'true')
  )
  WITH CHECK (
    "companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR ("companyId" IS NULL AND current_setting('app.is_super_admin', true) = 'true')
  );

-- ----------------------------------------------------------------------------
-- 2. Join-based policies for financially critical child tables
-- ----------------------------------------------------------------------------

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_entry_lines
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_lines."journalEntryId"
      AND je."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_invoice_lines
  USING (EXISTS (
    SELECT 1 FROM sales_invoices si
    WHERE si.id = sales_invoice_lines."salesInvoiceId"
      AND si."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_invoice_lines
  USING (EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = purchase_invoice_lines."purchaseInvoiceId"
      AND pi."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_count_lines
  USING (EXISTS (
    SELECT 1 FROM stock_counts sc
    WHERE sc.id = stock_count_lines."stockCountId"
      AND sc."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_items
  USING (EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.id = payroll_items."payrollRunId"
      AND pr."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON depreciation_schedules
  USING (EXISTS (
    SELECT 1 FROM fixed_assets fa
    WHERE fa.id = depreciation_schedules."assetId"
      AND fa."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset_transactions
  USING (EXISTS (
    SELECT 1 FROM fixed_assets fa
    WHERE fa.id = asset_transactions."assetId"
      AND fa."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

-- ----------------------------------------------------------------------------
-- 3. Global reference tables (companies, currencies, permissions, users) are
--    intentionally NOT row-secured here: `companies` is the tenant root
--    itself (access to which company a user may pick is governed by
--    user_company_access, not RLS), and currencies/permissions/users are
--    shared catalogs by design (a user's identity spans companies).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- BALANCED-JOURNAL-ENTRY GUARANTEE (database-level, independent of app code)
--
-- A deferred constraint trigger that runs once at COMMIT for any transaction
-- that touched journal_entry_lines, and rejects the whole transaction if any
-- journal entry it touched is left unbalanced (SUM(debit) <> SUM(credit)).
-- Deferring to commit time (rather than per-row) is required because a
-- journal entry is built by inserting multiple lines one at a time.
-- ============================================================================

ALTER TABLE journal_entry_lines
  ADD CONSTRAINT journal_entry_line_single_sided
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0));

CREATE OR REPLACE FUNCTION check_journal_entry_balanced() RETURNS trigger AS $$
DECLARE
  affected_entry_id uuid;
  total_debit numeric;
  total_credit numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_entry_id := OLD."journalEntryId";
  ELSE
    affected_entry_id := NEW."journalEntryId";
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_entry_lines
    WHERE "journalEntryId" = affected_entry_id;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Unbalanced journal entry %: debit % <> credit %',
      affected_entry_id, total_debit, total_credit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_entry_lines_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balanced();
