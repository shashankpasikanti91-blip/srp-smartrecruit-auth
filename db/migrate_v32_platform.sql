-- v32: Platform completion — global search history, notification archive, feature flags, announcements
-- Run: psql "$DATABASE_URL" -f nextjs-auth/db/migrate_v32_platform.sql

-- ── Global search history (per user, tenant-scoped) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.global_search_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,
  result_type TEXT,
  result_id   TEXT,
  result_label TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_search_user
  ON public.global_search_history (tenant_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  query       TEXT NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_user_name
  ON public.saved_searches (tenant_id, user_id, lower(name));

-- ── Notifications: archive ───────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS notifications_user_active_idx
  ON public.notifications (user_id, is_archived, is_read, created_at DESC);

-- ── Platform feature flags (super-admin) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_feature_flags (key, enabled, description) VALUES
  ('maintenance_mode', FALSE, 'Show maintenance banner / block non-owner writes'),
  ('bulk_upload', TRUE, 'Allow bulk CV queue'),
  ('ai_screening', TRUE, 'Allow AI screening tools'),
  ('generate_post', TRUE, 'Allow AI job post generation'),
  ('boolean_search', TRUE, 'Allow boolean search'),
  ('ess_module', TRUE, 'Allow ESS employee self-service'),
  ('internal_match', TRUE, 'Allow internal talent match')
ON CONFLICT (key) DO NOTHING;

-- ── Platform announcements ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'warning', 'critical')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
