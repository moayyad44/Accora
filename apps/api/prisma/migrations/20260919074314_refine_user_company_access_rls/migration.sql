-- ============================================================================
-- REFINEMENT: "which companies can I switch into?" is a legitimate
-- cross-tenant read — the whole point of user_company_access is to let one
-- authenticated user discover every company they belong to, before any
-- single company has been chosen as the active tenant context.
--
-- Extend the policy so a row is visible when EITHER:
--   a) it belongs to the currently active company (companyId match) — used
--      when an admin lists who has access within their company, or
--   b) it belongs to the currently authenticated user (userId match) —
--      used by login / "list my companies" before a company is chosen.
--
-- Writes (granting a user access to a company) stay restricted to the
-- companyId branch only: granting access is an admin action performed from
-- within the target company's own context, not just "because it's me".
-- ============================================================================

ALTER POLICY tenant_isolation ON user_company_access
  USING (
    "companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    "companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  );
