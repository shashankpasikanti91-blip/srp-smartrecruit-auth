-- ============================================================
-- Migration v8: Multi-Tenant SaaS Architecture
-- ============================================================
-- What this adds:
--   1. tenants table            — each company/organisation is a tenant
--   2. tenant_members table     — users belong to one or more tenants
--   3. tenant_id on key tables  — scopes all data per tenant
--   4. Sequences for TEN- IDs
--   5. Permissions JSONB column on tenant_members
--   6. Seed two demo tenants (Harish / Priya)
--   7. Migrate existing solo-user rows to their own tenant
--
-- Run: psql -U srp_auth -d srp_auth -f migrate_v8_multitenant.sql
-- Safe to run multiple times (all IF NOT EXISTS / ON CONFLICT).
-- ============================================================

BEGIN;

-- ── Sequence for tenant short IDs
CREATE SEQUENCE IF NOT EXISTS tenants_short_id_seq START 1000;

-- ============================================================
-- 1. TENANTS (Organisations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE
                              DEFAULT 'TEN-' || LPAD(CAST(nextval('tenants_short_id_seq') AS TEXT), 6, '0'),
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,           -- URL-safe org slug, e.g. "harish-tech"
  logo_url        TEXT,
  website         TEXT,
  industry        TEXT,
  size            TEXT        DEFAULT 'small',           -- 'solo'|'small'|'medium'|'enterprise'
  country         TEXT        DEFAULT 'IN',
  timezone        TEXT        DEFAULT 'Asia/Kolkata',
  plan            TEXT        NOT NULL DEFAULT 'free',   -- 'free'|'pro'|'enterprise'
  plan_status     TEXT        NOT NULL DEFAULT 'active', -- 'active'|'past_due'|'cancelled'
  max_users       INTEGER     NOT NULL DEFAULT 3,        -- seat limit per plan
  max_jobs        INTEGER     NOT NULL DEFAULT 5,
  max_candidates  INTEGER     NOT NULL DEFAULT 200,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  settings        JSONB       NOT NULL DEFAULT '{}',     -- branding, feature flags, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx   ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS tenants_plan_idx   ON public.tenants (plan);

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. TENANT MEMBERS (User ↔ Tenant with roles & permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'member', -- 'owner'|'admin'|'recruiter'|'member'|'viewer'
  -- Granular permissions (true = allowed, false/absent = denied)
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
  invite_token    TEXT        UNIQUE,                    -- pending invite
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

DROP TRIGGER IF EXISTS tenant_members_updated_at ON public.tenant_members;
CREATE TRIGGER tenant_members_updated_at
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. ADD tenant_id to all scoped tables
-- ============================================================

-- job_posts
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS job_posts_tenant_idx ON public.job_posts (tenant_id);

-- resumes
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS resumes_tenant_idx ON public.resumes (tenant_id);

-- token_usage
ALTER TABLE public.token_usage
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS token_usage_tenant_idx ON public.token_usage (tenant_id);

-- audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON public.audit_logs (tenant_id);

-- api_keys (if table exists)
DO $$ BEGIN
  ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- comm_channels
DO $$ BEGIN
  ALTER TABLE public.comm_channels
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- email_templates
DO $$ BEGIN
  ALTER TABLE public.email_templates
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- integrations
DO $$ BEGIN
  ALTER TABLE public.integrations
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ============================================================
-- 4. PORTAL INTEGRATION CREDENTIALS (per tenant)
--    Stores encrypted API keys for Naukri, Monster, LinkedIn etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_credentials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  portal          TEXT        NOT NULL,   -- 'naukri'|'monster'|'linkedin'|'indeed'|'shine'|'glassdoor'
  api_key         TEXT,                   -- encrypted at-rest (AES-256 in app layer)
  api_secret      TEXT,                   -- encrypted
  username        TEXT,
  password_enc    TEXT,                   -- encrypted
  base_url        TEXT,                   -- override endpoint if needed
  extra_config    JSONB       DEFAULT '{}', -- portal-specific extras
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_tested_at  TIMESTAMPTZ,
  last_test_ok    BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_credentials_uq UNIQUE (tenant_id, portal)
);

CREATE INDEX IF NOT EXISTS portal_creds_tenant_idx ON public.portal_credentials (tenant_id);
DROP TRIGGER IF EXISTS portal_creds_updated_at ON public.portal_credentials;
CREATE TRIGGER portal_creds_updated_at
  BEFORE UPDATE ON public.portal_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. PORTAL SEARCH HISTORY
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS portal_search_short_id_seq START 1000;

CREATE TABLE IF NOT EXISTS public.portal_searches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE
                              DEFAULT 'PSR-' || LPAD(CAST(nextval('portal_search_short_id_seq') AS TEXT), 6, '0'),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  portal          TEXT        NOT NULL,
  query           TEXT        NOT NULL,               -- the boolean/keyword query sent
  filters         JSONB       DEFAULT '{}',           -- location, exp, salary, etc.
  result_count    INTEGER     DEFAULT 0,
  results         JSONB       DEFAULT '[]',           -- raw portal response (profiles list)
  imported_count  INTEGER     DEFAULT 0,              -- how many imported as candidates
  status          TEXT        DEFAULT 'completed',    -- 'running'|'completed'|'failed'
  error_msg       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portal_searches_tenant_idx ON public.portal_searches (tenant_id);
CREATE INDEX IF NOT EXISTS portal_searches_portal_idx ON public.portal_searches (portal);
CREATE INDEX IF NOT EXISTS portal_searches_date_idx   ON public.portal_searches (created_at DESC);

-- ============================================================
-- 6. EMAIL OAUTH CONNECTIONS (Gmail / Outlook per tenant+user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('gmail','outlook','smtp')),
  email           TEXT        NOT NULL,              -- the sending address
  access_token    TEXT,                              -- encrypted, OAuth access token
  refresh_token   TEXT,                              -- encrypted, OAuth refresh token
  token_expiry    TIMESTAMPTZ,
  smtp_host       TEXT,                              -- SMTP fallback
  smtp_port       INTEGER,
  smtp_user       TEXT,
  smtp_pass_enc   TEXT,                              -- encrypted
  from_name       TEXT,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,-- default sending connection for tenant
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_connections_uq UNIQUE (tenant_id, user_id, provider, email)
);

CREATE INDEX IF NOT EXISTS email_connections_tenant_idx ON public.email_connections (tenant_id);
CREATE INDEX IF NOT EXISTS email_connections_user_idx   ON public.email_connections (user_id);

DROP TRIGGER IF EXISTS email_connections_updated_at ON public.email_connections;
CREATE TRIGGER email_connections_updated_at
  BEFORE UPDATE ON public.email_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. INTERVIEWS (interview scheduling with calendar integration)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS interviews_short_id_seq START 1000;

CREATE TABLE IF NOT EXISTS public.interviews (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id          TEXT        UNIQUE
                                DEFAULT 'INT-' || LPAD(CAST(nextval('interviews_short_id_seq') AS TEXT), 6, '0'),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  resume_id         UUID        REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_post_id       UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  candidate_name    TEXT        NOT NULL,
  candidate_email   TEXT        NOT NULL,
  interviewer_name  TEXT,
  interviewer_email TEXT,
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER     NOT NULL DEFAULT 45,
  format            TEXT        NOT NULL DEFAULT 'video'
                                CHECK (format IN ('video','phone','in_person','panel','async')),
  location_or_link  TEXT,       -- physical addr OR pre-existing video link
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show','rescheduled')),
  -- Calendar integration
  calendar_provider TEXT        CHECK (calendar_provider IN ('google','outlook','none')),
  calendar_event_id TEXT,       -- event ID from Google/Outlook
  meet_link         TEXT,       -- auto-created Google Meet or Teams link
  -- Notifications
  reminder_sent_at  TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  notes             TEXT,
  feedback          TEXT,       -- post-interview notes
  rating            INTEGER     CHECK (rating BETWEEN 1 AND 5),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interviews_tenant_idx  ON public.interviews (tenant_id);
CREATE INDEX IF NOT EXISTS interviews_user_idx    ON public.interviews (user_id);
CREATE INDEX IF NOT EXISTS interviews_resume_idx  ON public.interviews (resume_id);
CREATE INDEX IF NOT EXISTS interviews_job_idx     ON public.interviews (job_post_id);
CREATE INDEX IF NOT EXISTS interviews_date_idx    ON public.interviews (scheduled_at);
CREATE INDEX IF NOT EXISTS interviews_status_idx  ON public.interviews (status);

DROP TRIGGER IF EXISTS interviews_updated_at ON public.interviews;
CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. CALENDAR OAUTH (per tenant+user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('google','outlook')),
  email           TEXT        NOT NULL,
  access_token    TEXT,       -- encrypted
  refresh_token   TEXT,       -- encrypted
  token_expiry    TIMESTAMPTZ,
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

DROP TRIGGER IF EXISTS calendar_connections_updated_at ON public.calendar_connections;
CREATE TRIGGER calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. SEED DEMO TENANTS
-- ============================================================

-- Tenant 1: Harish Kumar — TechHire Solutions
INSERT INTO public.tenants (name, slug, industry, size, country, plan, plan_status, max_users, max_jobs, max_candidates,
  settings)
VALUES (
  'TechHire Solutions',
  'techhire-solutions',
  'Information Technology',
  'small',
  'IN',
  'pro',
  'active',
  10, 20, 1000,
  '{"brand_color": "#1D4ED8", "logo_text": "TH", "default_timezone": "Asia/Kolkata"}'
)
ON CONFLICT (slug) DO NOTHING;

-- Tenant 2: Priya Sharma — PeopleFirst HR
INSERT INTO public.tenants (name, slug, industry, size, country, plan, plan_status, max_users, max_jobs, max_candidates,
  settings)
VALUES (
  'PeopleFirst HR',
  'peoplefirst-hr',
  'Human Resources',
  'small',
  'IN',
  'pro',
  'active',
  10, 20, 1000,
  '{"brand_color": "#7C3AED", "logo_text": "PF", "default_timezone": "Asia/Kolkata"}'
)
ON CONFLICT (slug) DO NOTHING;

-- Harish's user account (credentials login)
INSERT INTO public.auth_users (name, email, provider, role, product_access)
VALUES ('Harish Kumar', 'harish@techhire.in', 'credentials', 'user', ARRAY['recruit','analytics'])
ON CONFLICT (email) DO UPDATE
  SET name = 'Harish Kumar', role = 'user', product_access = ARRAY['recruit','analytics'], updated_at = NOW();

-- Priya's user account
INSERT INTO public.auth_users (name, email, provider, role, product_access)
VALUES ('Priya Sharma', 'priya@peoplefirst.in', 'credentials', 'user', ARRAY['recruit','analytics'])
ON CONFLICT (email) DO UPDATE
  SET name = 'Priya Sharma', role = 'user', product_access = ARRAY['recruit','analytics'], updated_at = NOW();

-- Free subscriptions for demo users
INSERT INTO public.subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
  SELECT id, 'pro', 'active', 'monthly', 0, 'usd'
  FROM   public.auth_users
  WHERE  email IN ('harish@techhire.in', 'priya@peoplefirst.in')
  AND    id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT DO NOTHING;

-- Link Harish → TechHire Solutions as owner
INSERT INTO public.tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
SELECT
  t.id,
  u.id,
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
FROM public.tenants t, public.auth_users u
WHERE t.slug = 'techhire-solutions' AND u.email = 'harish@techhire.in'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Link Priya → PeopleFirst HR as owner
INSERT INTO public.tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
SELECT
  t.id,
  u.id,
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
FROM public.tenants t, public.auth_users u
WHERE t.slug = 'peoplefirst-hr' AND u.email = 'priya@peoplefirst.in'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ============================================================
-- 10. MIGRATE EXISTING SOLO-USER DATA
--     Every existing auth_user who isn't already a tenant member
--     gets their own personal tenant automatically.
-- ============================================================
DO $$
DECLARE
  usr RECORD;
  new_tenant_id UUID;
  slug_base TEXT;
  slug_final TEXT;
BEGIN
  FOR usr IN
    SELECT u.id, u.name, u.email
    FROM public.auth_users u
    WHERE u.id NOT IN (SELECT user_id FROM public.tenant_members)
  LOOP
    -- Build a URL-safe slug from email prefix
    slug_base := LOWER(REGEXP_REPLACE(SPLIT_PART(usr.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    slug_final := slug_base;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = slug_final) LOOP
      slug_final := slug_base || '-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
    END LOOP;

    INSERT INTO public.tenants (name, slug, plan, plan_status, is_active)
    VALUES (
      COALESCE(usr.name, SPLIT_PART(usr.email, '@', 1)),
      slug_final,
      'free',
      'active',
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

    -- Back-fill tenant_id on existing jobs and resumes
    UPDATE public.job_posts SET tenant_id = new_tenant_id WHERE user_id = usr.id AND tenant_id IS NULL;
    UPDATE public.resumes    SET tenant_id = new_tenant_id WHERE user_id = usr.id AND tenant_id IS NULL;

    RAISE NOTICE 'Created tenant % for user %', slug_final, usr.email;
  END LOOP;
END;
$$;

-- ============================================================
-- 11. VERIFY
-- ============================================================
SELECT
  t.short_id,
  t.name,
  t.slug,
  t.plan,
  COUNT(tm.id) AS member_count
FROM public.tenants t
LEFT JOIN public.tenant_members tm ON tm.tenant_id = t.id
GROUP BY t.id
ORDER BY t.created_at;

COMMIT;
