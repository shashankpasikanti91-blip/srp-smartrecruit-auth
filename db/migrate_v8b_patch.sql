-- ============================================================
-- Migration v8b: Column alignment patch
-- Fixes column name mismatches between v8 migration and app code.
-- Safe to run even if v8 was not yet run (uses IF NOT EXISTS).
-- Run AFTER migrate_v8_multitenant.sql.
-- ============================================================
BEGIN;

-- ── 1. portal_searches: rename query → query_text, result_count → total_found
ALTER TABLE public.portal_searches
  RENAME COLUMN IF EXISTS query TO query_text;

ALTER TABLE public.portal_searches
  RENAME COLUMN IF EXISTS result_count TO total_found;

-- Add 'results' column if missing (stores profile array JSON)
ALTER TABLE public.portal_searches
  ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]';

-- ── 2. email_connections: rename columns to match app code
--    email → email_address
--    access_token → access_token_enc
--    refresh_token → refresh_token_enc
--    add display_name
DO $$ BEGIN
  ALTER TABLE public.email_connections RENAME COLUMN email TO email_address;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.email_connections RENAME COLUMN access_token TO access_token_enc;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.email_connections RENAME COLUMN refresh_token TO refresh_token_enc;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Remove old 'email' UNIQUE constraint if it targeted wrong column
-- (psql will error if constraint doesn't exist, wrap in DO block)
DO $$
BEGIN
  ALTER TABLE public.email_connections
    DROP CONSTRAINT IF EXISTS email_connections_uq;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recreate unique constraint with correct column names
ALTER TABLE public.email_connections
  ADD CONSTRAINT IF NOT EXISTS email_connections_uq
  UNIQUE (tenant_id, user_id, provider);

-- ── 3. calendar_connections: same ename renames
DO $$ BEGIN
  ALTER TABLE public.calendar_connections RENAME COLUMN email TO email_address;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.calendar_connections RENAME COLUMN access_token TO access_token_enc;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.calendar_connections RENAME COLUMN refresh_token TO refresh_token_enc;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ── 4. interviews: add missing columns referenced in app code
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interviewer_id   UUID REFERENCES public.auth_users(id) ON DELETE SET NULL;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS platform         TEXT;
  -- 'google_meet'|'teams'|'zoom'|'other'

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS location         TEXT;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS meet_link        TEXT;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Rename legacy column if it exists
DO $$ BEGIN
  ALTER TABLE public.interviews RENAME COLUMN location_or_link TO _location_or_link_deprecated;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- Create index on interviewer_id for fast lookup
CREATE INDEX IF NOT EXISTS interviews_interviewer_idx ON public.interviews (interviewer_id);
CREATE INDEX IF NOT EXISTS interviews_calendar_idx    ON public.interviews (calendar_event_id) WHERE calendar_event_id IS NOT NULL;

-- ── 5. resumes: add extra columns used by portal import
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS location         TEXT;
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS source           TEXT DEFAULT 'upload';
  -- 'upload'|'naukri_import'|'monster_import'|'shine_import'|'manual'

-- ── 6. job_posts: add salary/experience columns used by improved modal
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS salary_min      NUMERIC(10,2);
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS salary_max      NUMERIC(10,2);
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS experience_min  INTEGER;
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS experience_max  INTEGER;
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS department      TEXT;

-- ── 7. import_batches: add tenant_id for multi-tenant scoping
DO $$ BEGIN
  ALTER TABLE public.import_batches
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS import_batches_tenant_idx ON public.import_batches (tenant_id);

-- ── 8. resumes: add tenant_id (if v8 migration didn't add it already)
DO $$ BEGIN
  ALTER TABLE public.resumes
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS resumes_tenant_idx ON public.resumes (tenant_id);

COMMIT;
