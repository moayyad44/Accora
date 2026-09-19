-- ============================================================================
-- HR row-level security gap fix (Phase 9).
--
-- contracts, attendance, leaves and loans have existed since the Phase 2
-- schema but were never added to the RLS migration's join-based policy
-- section (docs/DATABASE.md §3) — none of them carry a direct companyId
-- column (only employeeId), and the original migration's explicit list of
-- joined child tables simply didn't include them yet, since HR wasn't
-- built out at the time. That is a real gap in the second isolation layer,
-- not a stylistic one: without this, a compromised or buggy query running
-- as app_user could read/write another company's employee contracts,
-- attendance, leave requests or loans. Closed here before the payroll
-- feature (which reads all four) ships, using the exact same join-to-parent
-- pattern already used for journal_entry_lines / payroll_items / etc.
-- ============================================================================

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contracts
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = contracts."employeeId"
      AND e."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance."employeeId"
      AND e."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leaves
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = leaves."employeeId"
      AND e."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON loans
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = loans."employeeId"
      AND e."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));
