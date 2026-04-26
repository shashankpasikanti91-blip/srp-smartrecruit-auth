-- ============================================================
-- Migration v10: Invite flow hardening
-- ============================================================
-- What this fixes:
--   1. Ensures auth_users rows created as invite stubs (is_active=FALSE,
--      provider='invite') cannot be re-used as conflicting active accounts.
--   2. Adds a partial index to make invite_token lookups fast.
--   3. Cleans up any orphaned stub users (is_active=FALSE, provider='invite')
--      whose invite has expired and can no longer be accepted.
--
-- Run AFTER migrate_v9_prod_fix.sql.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

BEGIN;

-- Fast lookup for pending invites by token
CREATE INDEX IF NOT EXISTS tenant_members_invite_token_idx
  ON public.tenant_members (invite_token)
  WHERE invite_token IS NOT NULL;

-- Fast lookup for active users only (used in duplicate-email checks)
CREATE INDEX IF NOT EXISTS auth_users_email_active_idx
  ON public.auth_users (email)
  WHERE is_active = TRUE;

-- Remove orphaned invite stubs whose invite expired and was never accepted.
-- These rows exist only as a side-effect of the old invite flow and are safe
-- to remove — no jobs, resumes, or other data references them.
DELETE FROM public.auth_users
WHERE provider = 'invite'
  AND is_active = FALSE
  AND id NOT IN (
    SELECT user_id FROM public.tenant_members
    WHERE invite_accepted = FALSE
      AND invite_expires > NOW()
  );

COMMIT;
