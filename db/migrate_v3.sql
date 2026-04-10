-- ============================================================
-- SRP AI Labs SmartRecruit — Schema v3 Migration
-- Safe to run multiple times (all are IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Applied to production: docker exec srp-auth-db psql -U srp_auth -d srp_auth -f /migration-v3.sql
-- ============================================================

-- ── Sequences for human-readable IDs ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS users_short_id_seq      START 1000;
CREATE SEQUENCE IF NOT EXISTS jobs_short_id_seq       START 1000;
CREATE SEQUENCE IF NOT EXISTS resumes_short_id_seq    START 1000;

-- ── auth_users: short_id ─────────────────────────────────────────────────────
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Backfill existing rows
UPDATE public.auth_users
  SET short_id = 'USR-' || LPAD(CAST(nextval('users_short_id_seq') AS TEXT), 6, '0')
  WHERE short_id IS NULL;

-- Make default for future rows
ALTER TABLE public.auth_users
  ALTER COLUMN short_id SET DEFAULT 'USR-' || LPAD(CAST(nextval('users_short_id_seq') AS TEXT), 6, '0');

-- ── job_posts: short_id ───────────────────────────────────────────────────────
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

UPDATE public.job_posts
  SET short_id = 'JOB-' || LPAD(CAST(nextval('jobs_short_id_seq') AS TEXT), 6, '0')
  WHERE short_id IS NULL;

ALTER TABLE public.job_posts
  ALTER COLUMN short_id SET DEFAULT 'JOB-' || LPAD(CAST(nextval('jobs_short_id_seq') AS TEXT), 6, '0');

-- ── resumes: short_id, pipeline_stage, match_category ────────────────────────
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

UPDATE public.resumes
  SET short_id = 'RES-' || LPAD(CAST(nextval('resumes_short_id_seq') AS TEXT), 6, '0')
  WHERE short_id IS NULL;

ALTER TABLE public.resumes
  ALTER COLUMN short_id SET DEFAULT 'RES-' || LPAD(CAST(nextval('resumes_short_id_seq') AS TEXT), 6, '0');

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'applied';

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS match_category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN ai_score >= 75 THEN 'best'
      WHEN ai_score >= 60 THEN 'good'
      WHEN ai_score >= 45 THEN 'partial'
      WHEN ai_score IS NOT NULL THEN 'poor'
      ELSE NULL
    END
  ) STORED;

-- ── job_post_contents: persisted generated social posts ──────────────────────
CREATE TABLE IF NOT EXISTS public.job_post_contents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID        NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  linkedin    TEXT,
  whatsapp    TEXT,
  email       TEXT,
  twitter     TEXT,
  indeed      TEXT,
  telegram    TEXT,
  facebook    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_post_contents_job_idx  ON public.job_post_contents (job_post_id);
CREATE INDEX IF NOT EXISTS job_post_contents_user_idx ON public.job_post_contents (user_id);

DROP TRIGGER IF EXISTS job_post_contents_updated_at ON public.job_post_contents;
CREATE TRIGGER job_post_contents_updated_at
  BEFORE UPDATE ON public.job_post_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── subscriptions: ensure every user has a row (backfill) ────────────────────
INSERT INTO public.subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
  SELECT id, 'free', 'active', 'monthly', 0, 'usd'
  FROM   public.auth_users
  WHERE  id NOT IN (SELECT user_id FROM public.subscriptions)
  ON CONFLICT DO NOTHING;

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS resumes_pipeline_idx   ON public.resumes (pipeline_stage);
CREATE INDEX IF NOT EXISTS resumes_match_idx      ON public.resumes (match_category);
CREATE INDEX IF NOT EXISTS job_posts_short_id_idx ON public.job_posts (short_id);
CREATE INDEX IF NOT EXISTS resumes_short_id_idx   ON public.resumes (short_id);

SELECT 'Migration v3 complete ✓' AS result;
