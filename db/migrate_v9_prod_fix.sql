-- ============================================================
-- Migration v9: Production Fix — Apply all multitenant schema
-- This is a SAFE, IDEMPOTENT migration that:
--   1. Creates tenants + tenant_members tables
--   2. Creates all supporting tables (portals, email, calendar, interviews)
--   3. Adds tenant_id to job_posts and resumes
--   4. Provisions a personal tenant for EVERY existing auth_user
--   5. Back-fills tenant_id on ALL existing jobs + resumes
--   6. Adds missing columns (source_type, last_contacted_at, etc.)
-- 
-- DATA IS NEVER DELETED. All existing records are preserved.
-- Safe to re-run (all IF NOT EXISTS / ON CONFLICT).
-- ============================================================

BEGIN;

-- ── Sequences for short IDs
CREATE SEQUENCE IF NOT EXISTS tenants_short_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS portal_search_short_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS interviews_short_id_seq START 1000;

-- ============================================================
-- 1. TENANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE
                              DEFAULT 'TEN-' || LPAD(CAST(nextval('tenants_short_id_seq') AS TEXT), 6, '0'),
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,
  logo_url        TEXT,
  website         TEXT,
  industry        TEXT,
  size            TEXT        DEFAULT 'small',
  country         TEXT        DEFAULT 'IN',
  timezone        TEXT        DEFAULT 'Asia/Kolkata',
  plan            TEXT        NOT NULL DEFAULT 'free',
  plan_status     TEXT        NOT NULL DEFAULT 'active',
  max_users       INTEGER     NOT NULL DEFAULT 3,
  max_jobs        INTEGER     NOT NULL DEFAULT 5,
  max_candidates  INTEGER     NOT NULL DEFAULT 200,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  settings        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS tenants_plan_idx ON public.tenants (plan);

-- ============================================================
-- 2. TENANT MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'member',
  permissions     JSONB       NOT NULL DEFAULT '{
    "jobs":        {"create":true,"read":true,"update":true,"delete":false},
    "candidates":  {"create":true,"read":true,"update":true,"delete":false},
    "pipeline":    {"read":true,"update":true},
    "ai_screen":   {"use":true},
    "ai_compose":  {"use":true},
    "jd_intel":    {"use":true},
    "boolean_search":{"use":true},
    "integrations":{"read":false,"update":false},
    "billing":     {"read":false,"update":false},
    "users":       {"invite":false,"manage":false}
  }',
  invited_by      UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  invite_token    TEXT        UNIQUE,
  invite_accepted BOOLEAN     NOT NULL DEFAULT FALSE,
  invite_expires  TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_members_uq UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_members_tenant_idx ON public.tenant_members (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_members_user_idx   ON public.tenant_members (user_id);
CREATE INDEX IF NOT EXISTS tenant_members_role_idx   ON public.tenant_members (role);

-- ============================================================
-- 3. ADD tenant_id COLUMNS TO EXISTING TABLES
-- ============================================================

-- job_posts
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS job_posts_tenant_idx ON public.job_posts (tenant_id);

-- resumes
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS resumes_tenant_idx ON public.resumes (tenant_id);

-- Add extra resume columns if missing
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS experience_years INTEGER;

-- token_usage
ALTER TABLE public.token_usage
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS token_usage_tenant_idx ON public.token_usage (tenant_id);

-- audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON public.audit_logs (tenant_id);

-- api_keys
DO $$ BEGIN
  ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- integrations
DO $$ BEGIN
  ALTER TABLE public.integrations
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ============================================================
-- 4. PORTAL CREDENTIALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_credentials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  portal          TEXT        NOT NULL,
  api_key         TEXT,
  api_secret      TEXT,
  username        TEXT,
  password_enc    TEXT,
  base_url        TEXT,
  extra_config    JSONB       DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_tested_at  TIMESTAMPTZ,
  last_test_ok    BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_credentials_uq UNIQUE (tenant_id, portal)
);
CREATE INDEX IF NOT EXISTS portal_creds_tenant_idx ON public.portal_credentials (tenant_id);

-- ============================================================
-- 5. PORTAL SEARCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_searches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE
                              DEFAULT 'PSR-' || LPAD(CAST(nextval('portal_search_short_id_seq') AS TEXT), 6, '0'),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  portal          TEXT        NOT NULL,
  query_text      TEXT        NOT NULL,
  filters         JSONB       DEFAULT '{}',
  total_found     INTEGER     DEFAULT 0,
  results         JSONB       DEFAULT '[]',
  imported_count  INTEGER     DEFAULT 0,
  status          TEXT        DEFAULT 'completed',
  error_msg       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_searches_tenant_idx ON public.portal_searches (tenant_id);
CREATE INDEX IF NOT EXISTS portal_searches_date_idx   ON public.portal_searches (created_at DESC);

-- ============================================================
-- 6. EMAIL CONNECTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('gmail','outlook','smtp')),
  email_address   TEXT        NOT NULL,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expiry    TIMESTAMPTZ,
  smtp_host       TEXT,
  smtp_port       INTEGER,
  smtp_user       TEXT,
  smtp_pass_enc   TEXT,
  from_name       TEXT,
  display_name    TEXT,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_connections_uq UNIQUE (tenant_id, user_id, provider)
);
CREATE INDEX IF NOT EXISTS email_connections_tenant_idx ON public.email_connections (tenant_id);
CREATE INDEX IF NOT EXISTS email_connections_user_idx   ON public.email_connections (user_id);

-- ============================================================
-- 7. CALENDAR CONNECTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('google','outlook')),
  email_address   TEXT        NOT NULL,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expiry    TIMESTAMPTZ,
  display_name    TEXT,
  calendar_id     TEXT        DEFAULT 'primary',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  scopes          TEXT[]      DEFAULT '{}',
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_connections_uq UNIQUE (tenant_id, user_id, provider)
);
CREATE INDEX IF NOT EXISTS calendar_conn_tenant_idx ON public.calendar_connections (tenant_id);
CREATE INDEX IF NOT EXISTS calendar_conn_user_idx   ON public.calendar_connections (user_id);

-- ============================================================
-- 8. INTERVIEWS TABLE — add missing columns to existing table
-- ============================================================
-- The interviews table already exists from old schema; add columns that may be missing
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS interviewer_id    UUID REFERENCES public.auth_users(id) ON DELETE SET NULL;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS platform          TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS location          TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS meet_link         TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

CREATE INDEX IF NOT EXISTS interviews_tenant_idx  ON public.interviews (tenant_id);
CREATE INDEX IF NOT EXISTS interviews_user_idx    ON public.interviews (user_id);
CREATE INDEX IF NOT EXISTS interviews_resume_idx  ON public.interviews (resume_id);
CREATE INDEX IF NOT EXISTS interviews_job_idx     ON public.interviews (job_post_id);
CREATE INDEX IF NOT EXISTS interviews_date_idx    ON public.interviews (scheduled_at);

-- ============================================================
-- 9. INTEGRATIONS TABLE — ensure new schema columns exist
-- ============================================================
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS slug      TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS label     TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS api_key_enc TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS config    JSONB NOT NULL DEFAULT '{}';

-- Copy provider → slug for old rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'provider'
  ) THEN
    UPDATE public.integrations SET slug = provider WHERE slug IS NULL;
  END IF;
END $$;
UPDATE public.integrations SET slug = 'unknown' WHERE slug IS NULL;

-- ============================================================
-- 10. PROVISION TENANT FOR EVERY EXISTING USER
--     Creates a personal tenant per user and links them as owner.
--     Back-fills tenant_id on all their existing job_posts + resumes.
-- ============================================================
DO $$
DECLARE
  usr         RECORD;
  new_tenant_id UUID;
  slug_base   TEXT;
  slug_final  TEXT;
  usr_plan    TEXT;
BEGIN
  FOR usr IN
    SELECT u.id, u.name, u.email, u.role,
           COALESCE(s.plan, 'free') AS plan
    FROM public.auth_users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.id NOT IN (SELECT user_id FROM public.tenant_members)
    ORDER BY u.created_at
  LOOP
    -- Determine plan from user role or subscription
    usr_plan := CASE
      WHEN usr.plan IN ('pro','enterprise') THEN usr.plan
      WHEN usr.role IN ('owner','pro','admin') THEN 'pro'
      ELSE 'free'
    END;

    -- Build URL-safe slug from email prefix
    slug_base  := LOWER(REGEXP_REPLACE(SPLIT_PART(usr.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    slug_base  := LEFT(slug_base, 40);
    slug_final := slug_base;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = slug_final) LOOP
      slug_final := slug_base || '-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
    END LOOP;

    INSERT INTO public.tenants (name, slug, plan, plan_status, max_users, max_jobs, max_candidates, is_active)
    VALUES (
      COALESCE(usr.name, SPLIT_PART(usr.email, '@', 1)),
      slug_final,
      usr_plan,
      'active',
      CASE WHEN usr_plan = 'pro' THEN 20 ELSE 5 END,
      CASE WHEN usr_plan = 'pro' THEN 100 ELSE 5 END,
      CASE WHEN usr_plan = 'pro' THEN 10000 ELSE 200 END,
      TRUE
    )
    RETURNING id INTO new_tenant_id;

    INSERT INTO public.tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
    VALUES (
      new_tenant_id,
      usr.id,
      'owner',
      TRUE,
      '{
        "jobs":         {"create":true,"read":true,"update":true,"delete":true},
        "candidates":   {"create":true,"read":true,"update":true,"delete":true},
        "pipeline":     {"read":true,"update":true},
        "ai_screen":    {"use":true},
        "ai_compose":   {"use":true},
        "jd_intel":     {"use":true},
        "boolean_search":{"use":true},
        "integrations": {"read":true,"update":true},
        "billing":      {"read":true,"update":true},
        "users":        {"invite":true,"manage":true}
      }'::jsonb
    );

    -- Back-fill tenant_id on all their jobs and resumes
    UPDATE public.job_posts SET tenant_id = new_tenant_id WHERE user_id = usr.id AND tenant_id IS NULL;
    UPDATE public.resumes    SET tenant_id = new_tenant_id WHERE user_id = usr.id AND tenant_id IS NULL;

    RAISE NOTICE 'Provisioned tenant "%" (plan=%) for user %', slug_final, usr_plan, usr.email;
  END LOOP;
END;
$$;

-- ============================================================
-- 11. VERIFY — show tenant summary
-- ============================================================
SELECT
  t.short_id,
  t.name,
  t.slug,
  t.plan,
  COUNT(DISTINCT tm.id) AS members,
  COUNT(DISTINCT jp.id) AS jobs,
  COUNT(DISTINCT r.id)  AS candidates
FROM public.tenants t
LEFT JOIN public.tenant_members tm ON tm.tenant_id = t.id
LEFT JOIN public.job_posts jp ON jp.tenant_id = t.id
LEFT JOIN public.resumes r ON r.tenant_id = t.id
GROUP BY t.id
ORDER BY t.created_at;

COMMIT;
