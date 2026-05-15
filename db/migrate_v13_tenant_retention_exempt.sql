-- v13: Mark long-term / client workspaces so automated retention jobs never purge them.
-- Apply once per environment after backup. Safe to re-run (IF NOT EXISTS).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS retention_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tenants.retention_exempt IS
  'When TRUE, automated post-subscription data cleanup must skip this tenant (e.g. named client workspaces). Also set SRP_PROTECTED_TENANT_IDS in env for belt-and-suspenders.';
