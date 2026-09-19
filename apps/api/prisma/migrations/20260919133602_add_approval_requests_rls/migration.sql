-- ============================================================================
-- Approval row-level security gap fix (Phase 12).
--
-- approval_requests and approval_actions have existed since the Phase 2
-- schema, but only approval_workflows (which carries companyId directly)
-- was ever added to the RLS migration. Neither approval_requests (linked
-- only via workflowId) nor approval_actions (linked only via requestId,
-- two hops from workflowId) carries companyId directly, and neither was
-- added to the join-based policy section either — a gap in the second
-- isolation layer, not a stylistic one: without this, a compromised or
-- buggy query running as app_user could read or write another company's
-- approval requests/actions. Closed here before the approval engine
-- (Phase 12) actually starts writing to these tables, using the same
-- join-to-parent pattern already used elsewhere (docs/DATABASE.md §3).
-- ============================================================================

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approval_requests
  USING (EXISTS (
    SELECT 1 FROM approval_workflows aw
    WHERE aw.id = approval_requests."workflowId"
      AND aw."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approval_actions
  USING (EXISTS (
    SELECT 1 FROM approval_requests ar
    JOIN approval_workflows aw ON aw.id = ar."workflowId"
    WHERE ar.id = approval_actions."requestId"
      AND aw."companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));
