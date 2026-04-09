-- ============================================================
-- SRP AI Labs — Schema v2 Migration
-- Run AFTER schema.sql (additive — safe on existing data)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Add password_hash column for email/password auth ─────────────────────────
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- ── Sequences for human-readable IDs ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS users_short_id_seq       START 1;
CREATE SEQUENCE IF NOT EXISTS jobs_short_id_seq        START 1;
CREATE SEQUENCE IF NOT EXISTS resumes_short_id_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS candidates_short_id_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS campaigns_short_id_seq   START 1;

-- ── Add short_id to existing tables ──────────────────────────────────────────
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE
  DEFAULT 'USR-' || LPAD(CAST(nextval('users_short_id_seq') AS TEXT), 6, '0');

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE
  DEFAULT 'JOB-' || LPAD(CAST(nextval('jobs_short_id_seq') AS TEXT), 6, '0');

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE
  DEFAULT 'RES-' || LPAD(CAST(nextval('resumes_short_id_seq') AS TEXT), 6, '0');

-- ── Extend resumes with pipeline + enrichment ─────────────────────────────────
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'applied'
  CHECK (pipeline_stage IN ('sourced','applied','screening','interview','offer','hired','rejected'));

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS match_category TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN ai_score >= 80 THEN 'best'
      WHEN ai_score >= 60 THEN 'good'
      WHEN ai_score >= 40 THEN 'partial'
      WHEN ai_score IS NOT NULL THEN 'poor'
      ELSE NULL
    END
  ) STORED;

-- ── Extend job_posts with extra fields ───────────────────────────────────────
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS short_description TEXT;

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS experience_years TEXT;

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS skills_required  TEXT[];

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS department TEXT;

-- ── New: CANDIDATES table (standalone talent profiles) ─────────────────────
CREATE TABLE IF NOT EXISTS public.candidates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id         TEXT        UNIQUE NOT NULL
    DEFAULT 'CAND-' || LPAD(CAST(nextval('candidates_short_id_seq') AS TEXT), 6, '0'),
  user_id          UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  email            TEXT,
  phone            TEXT,
  location         TEXT,
  linkedin_url     TEXT,
  skills           TEXT[],
  experience_years NUMERIC(4,1),
  current_title    TEXT,
  current_company  TEXT,
  source           TEXT        NOT NULL DEFAULT 'manual',
  notes            TEXT,
  ai_summary       TEXT,
  ai_score         NUMERIC(5,2),
  match_category   TEXT
    GENERATED ALWAYS AS (
      CASE
        WHEN ai_score >= 80 THEN 'best'
        WHEN ai_score >= 60 THEN 'good'
        WHEN ai_score >= 40 THEN 'partial'
        WHEN ai_score IS NOT NULL THEN 'poor'
        ELSE NULL
      END
    ) STORED,
  pipeline_stage   TEXT        NOT NULL DEFAULT 'sourced'
    CHECK (pipeline_stage IN ('sourced','applied','screening','interview','offer','hired','rejected')),
  status           TEXT        NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS candidates_user_idx      ON public.candidates (user_id);
CREATE INDEX IF NOT EXISTS candidates_email_idx     ON public.candidates (email);
CREATE INDEX IF NOT EXISTS candidates_stage_idx     ON public.candidates (pipeline_stage);
CREATE INDEX IF NOT EXISTS candidates_short_id_idx  ON public.candidates (short_id);
CREATE INDEX IF NOT EXISTS candidates_score_idx     ON public.candidates (ai_score DESC);

DROP TRIGGER IF EXISTS candidates_updated_at ON public.candidates;
CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.candidates;
CREATE POLICY "service_role_all" ON public.candidates USING (true);

-- ── New: EMAIL CAMPAIGNS table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE NOT NULL
    DEFAULT 'CAM-' || LPAD(CAST(nextval('campaigns_short_id_seq') AS TEXT), 6, '0'),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  body_template   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft',
  frequency_days  INTEGER     NOT NULL DEFAULT 3,
  max_steps       INTEGER     NOT NULL DEFAULT 3,
  sent_count      INTEGER     NOT NULL DEFAULT 0,
  opened_count    INTEGER     NOT NULL DEFAULT 0,
  replied_count   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_user_idx   ON public.email_campaigns (user_id);
CREATE INDEX IF NOT EXISTS campaigns_job_idx    ON public.email_campaigns (job_post_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON public.email_campaigns (status);

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.email_campaigns;
CREATE POLICY "service_role_all" ON public.email_campaigns USING (true);

-- ── Indexes for short_id search ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS auth_users_short_id_idx ON public.auth_users (short_id);
CREATE INDEX IF NOT EXISTS job_posts_short_id_idx  ON public.job_posts  (short_id);
CREATE INDEX IF NOT EXISTS resumes_short_id_idx    ON public.resumes    (short_id);
CREATE INDEX IF NOT EXISTS resumes_stage_idx       ON public.resumes    (pipeline_stage);
CREATE INDEX IF NOT EXISTS resumes_match_idx       ON public.resumes    (match_category);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT table_name, COUNT(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
