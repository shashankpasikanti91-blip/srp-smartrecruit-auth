-- ============================================================
-- Migration v7: Globalisation & Hardening
-- Adds missing columns for full date/ID tracking, calendar
-- integration hooks, Gmail OAuth fields, and interview
-- scheduling support.
-- Safe to run multiple times (all IF NOT EXISTS).
-- ============================================================

-- 1. Ensure updated_at exists on all key tables
ALTER TABLE public.resumes    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.job_posts  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.auth_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Backfill short_id on auth_users if missing
ALTER TABLE public.auth_users ADD COLUMN IF NOT EXISTS short_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_short_id_idx ON public.auth_users (short_id) WHERE short_id IS NOT NULL;

-- Backfill using gen_random_uuid prefix (no sequence needed)
UPDATE public.auth_users
SET short_id = 'USR-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))
WHERE short_id IS NULL;

-- 3. Upload tracking: ensure source_type & source_batch_id exist
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'direct_upload';
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS source_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS full_ai_analysis JSONB DEFAULT NULL;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS screening_mode TEXT DEFAULT 'single';

-- 4. Interview scheduling support
CREATE TABLE IF NOT EXISTS public.interviews (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id          TEXT        UNIQUE DEFAULT 'INT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  user_id           UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  resume_id         UUID        REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_post_id       UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  candidate_name    TEXT,
  candidate_email   TEXT,
  interviewer_name  TEXT,
  interviewer_email TEXT,
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER     DEFAULT 60,
  format            TEXT        DEFAULT 'video'  -- 'video'|'phone'|'in_person'|'panel'
                    CHECK (format IN ('video','phone','in_person','panel','async')),
  location_or_link  TEXT,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','cancelled','completed','no_show')),
  notes             TEXT,
  calendar_event_id TEXT,       -- Google Calendar / Outlook event ID
  calendar_provider TEXT,       -- 'google'|'outlook'|'none'
  meet_link         TEXT,       -- auto-generated video link
  reminder_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interviews_user_idx    ON public.interviews (user_id);
CREATE INDEX IF NOT EXISTS interviews_resume_idx  ON public.interviews (resume_id);
CREATE INDEX IF NOT EXISTS interviews_job_idx     ON public.interviews (job_post_id);
CREATE INDEX IF NOT EXISTS interviews_date_idx    ON public.interviews (scheduled_at);
CREATE INDEX IF NOT EXISTS interviews_status_idx  ON public.interviews (status);

DROP TRIGGER IF EXISTS interviews_updated_at ON public.interviews;
CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Calendar integration settings per user
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('google','outlook','none')),
  access_token    TEXT,       -- encrypted in production
  refresh_token   TEXT,       -- encrypted in production
  token_expiry    TIMESTAMPTZ,
  calendar_id     TEXT,       -- default calendar ID
  email           TEXT,       -- connected account email
  is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
  scopes          TEXT[]      DEFAULT '{}',
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_integrations_user_provider_uq UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS calendar_user_idx ON public.calendar_integrations (user_id);

DROP TRIGGER IF EXISTS calendar_integrations_updated_at ON public.calendar_integrations;
CREATE TRIGGER calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Gmail/Outlook OAuth tokens (for sending from user's own account)
CREATE TABLE IF NOT EXISTS public.email_oauth_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL CHECK (provider IN ('gmail','outlook','yahoo')),
  email           TEXT        NOT NULL,
  access_token    TEXT,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  scopes          TEXT[]      DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_oauth_user_provider_uq UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS email_oauth_user_idx ON public.email_oauth_connections (user_id);

DROP TRIGGER IF EXISTS email_oauth_updated_at ON public.email_oauth_connections;
CREATE TRIGGER email_oauth_updated_at
  BEFORE UPDATE ON public.email_oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Ensure feature_flags table exists (used by /api/notify)
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.auth_users(id) ON DELETE CASCADE,
  feature     TEXT        NOT NULL,
  is_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  config      JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_uq UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS feature_flags_user_idx ON public.feature_flags (user_id);

-- 8. Ensure all triggers are in place for updated_at on tables that exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'resumes_updated_at') THEN
    CREATE TRIGGER resumes_updated_at
      BEFORE UPDATE ON public.resumes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_posts_updated_at') THEN
    CREATE TRIGGER job_posts_updated_at
      BEFORE UPDATE ON public.job_posts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auth_users_updated_at') THEN
    CREATE TRIGGER auth_users_updated_at
      BEFORE UPDATE ON public.auth_users
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 9. Add indexes for new date tracking
CREATE INDEX IF NOT EXISTS idx_resumes_updated_at     ON public.resumes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_posts_updated_at   ON public.job_posts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at  ON public.interviews (created_at DESC);

-- Done
SELECT 'Migration v7 Globalisation complete ✓' AS result;
