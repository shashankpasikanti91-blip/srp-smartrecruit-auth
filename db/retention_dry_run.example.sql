-- Example: list paid workspaces past grace (for ops review only — does NOT delete).
-- Adjust table/column names to match your schema after subscriptions are linked per tenant if needed.
-- Protected tenants: retention_exempt = TRUE or id in env SRP_PROTECTED_TENANT_IDS

-- SELECT t.id, t.name, t.slug, t.plan, t.plan_status
-- FROM tenants t
-- WHERE t.is_active = TRUE
--   AND COALESCE(t.retention_exempt, FALSE) = FALSE
--   AND ... -- join subscriptions / period end per your billing model
-- ;
