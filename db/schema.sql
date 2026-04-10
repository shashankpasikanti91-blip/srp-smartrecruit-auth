-- ============================================================
-- SRP AI Labs — Full Platform Schema (canonical, Docker-native)
-- Run once on fresh PostgreSQL: psql -U srp_auth -d srp_auth -f schema.sql
-- ============================================================

-- ── Helper: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS users_short_id_seq   START 1000;

CREATE TABLE IF NOT EXISTS public.auth_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE DEFAULT 'USR-' || LPAD(CAST(nextval('users_short_id_seq') AS TEXT), 6, '0'),
  name            TEXT,
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT,
  image           TEXT,
  provider        TEXT        NOT NULL DEFAULT 'google',
  provider_id     TEXT,
  role            TEXT        NOT NULL DEFAULT 'user',   -- 'user' | 'owner' | 'admin'
  product_access  TEXT[]      NOT NULL DEFAULT ARRAY['recruit'],
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_users_email_idx    ON public.auth_users (email);
CREATE INDEX IF NOT EXISTS auth_users_provider_idx ON public.auth_users (provider, provider_id);
CREATE INDEX IF NOT EXISTS auth_users_role_idx     ON public.auth_users (role);

DROP TRIGGER IF EXISTS auth_users_updated_at ON public.auth_users;
CREATE TRIGGER auth_users_updated_at
  BEFORE UPDATE ON public.auth_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  plan            TEXT        NOT NULL DEFAULT 'free',    -- 'free' | 'pro' | 'enterprise'
  status          TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'past_due' | 'cancelled' | 'trialing'
  billing_cycle   TEXT        NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
  amount_cents    INTEGER     NOT NULL DEFAULT 0,
  currency        TEXT        NOT NULL DEFAULT 'usd',
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  payment_method  TEXT,
  stripe_sub_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx   ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. JOB POSTS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS jobs_short_id_seq    START 1000;

CREATE TABLE IF NOT EXISTS public.job_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE DEFAULT 'JOB-' || LPAD(CAST(nextval('jobs_short_id_seq') AS TEXT), 6, '0'),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  company         TEXT,
  location        TEXT,
  type            TEXT        DEFAULT 'full-time', -- 'full-time' | 'part-time' | 'contract' | 'remote'
  description     TEXT,
  requirements    TEXT,
  salary_min      INTEGER,
  salary_max      INTEGER,
  currency        TEXT        DEFAULT 'USD',
  status          TEXT        NOT NULL DEFAULT 'active', -- 'draft' | 'active' | 'closed' | 'archived'
  applications_count INTEGER  NOT NULL DEFAULT 0,
  ai_generated    BOOLEAN     NOT NULL DEFAULT FALSE,
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_posts_user_idx    ON public.job_posts (user_id);
CREATE INDEX IF NOT EXISTS job_posts_status_idx  ON public.job_posts (status);
CREATE INDEX IF NOT EXISTS job_posts_created_idx ON public.job_posts (created_at DESC);

DROP TRIGGER IF EXISTS job_posts_updated_at ON public.job_posts;
CREATE TRIGGER job_posts_updated_at
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. JOB POST CONTENTS (persisted generated social media posts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_post_contents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID        NOT NULL UNIQUE REFERENCES public.job_posts(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS job_post_contents_user_idx ON public.job_post_contents (user_id);

DROP TRIGGER IF EXISTS job_post_contents_updated_at ON public.job_post_contents;
CREATE TRIGGER job_post_contents_updated_at
  BEFORE UPDATE ON public.job_post_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. RESUMES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS resumes_short_id_seq START 1000;

CREATE TABLE IF NOT EXISTS public.resumes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id        TEXT        UNIQUE DEFAULT 'RES-' || LPAD(CAST(nextval('resumes_short_id_seq') AS TEXT), 6, '0'),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  candidate_name  TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  file_name       TEXT,
  file_url        TEXT,
  file_size_bytes INTEGER,
  raw_text        TEXT,
  ai_score        NUMERIC(5,2),
  ai_summary      TEXT,
  ai_skills       TEXT[],
  pipeline_stage  TEXT        NOT NULL DEFAULT 'applied',
  match_category  TEXT        GENERATED ALWAYS AS (
    CASE
      WHEN ai_score >= 75 THEN 'best'
      WHEN ai_score >= 60 THEN 'good'
      WHEN ai_score >= 45 THEN 'partial'
      WHEN ai_score IS NOT NULL THEN 'poor'
      ELSE NULL
    END
  ) STORED,
  status          TEXT        NOT NULL DEFAULT 'pending',
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resumes_user_idx      ON public.resumes (user_id);
CREATE INDEX IF NOT EXISTS resumes_job_idx       ON public.resumes (job_post_id);
CREATE INDEX IF NOT EXISTS resumes_status_idx    ON public.resumes (status);
CREATE INDEX IF NOT EXISTS resumes_score_idx     ON public.resumes (ai_score DESC);
CREATE INDEX IF NOT EXISTS resumes_email_idx     ON public.resumes (candidate_email);
CREATE INDEX IF NOT EXISTS resumes_pipeline_idx  ON public.resumes (pipeline_stage);
CREATE INDEX IF NOT EXISTS resumes_match_idx     ON public.resumes (match_category);

DROP TRIGGER IF EXISTS resumes_updated_at ON public.resumes;
CREATE TRIGGER resumes_updated_at
  BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. TOKEN USAGE (AI API calls tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.token_usage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  model           TEXT        NOT NULL DEFAULT 'gpt-4',
  operation       TEXT        NOT NULL,
  prompt_tokens   INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER   NOT NULL DEFAULT 0,
  total_tokens    INTEGER     GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS token_usage_user_idx ON public.token_usage (user_id);
CREATE INDEX IF NOT EXISTS token_usage_date_idx ON public.token_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS token_usage_op_idx   ON public.token_usage (operation);

-- ============================================================
-- 7. ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  event_data      JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  severity        TEXT        NOT NULL DEFAULT 'info',
  notified        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_user_idx     ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_type_idx     ON public.activity_log (event_type);
CREATE INDEX IF NOT EXISTS activity_log_severity_idx ON public.activity_log (severity);
CREATE INDEX IF NOT EXISTS activity_log_date_idx     ON public.activity_log (created_at DESC);

-- ============================================================
-- 8. COMPLAINTS / SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  subject         TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  priority        TEXT        NOT NULL DEFAULT 'normal',
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS complaints_user_idx   ON public.complaints (user_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON public.complaints (status);

DROP TRIGGER IF EXISTS complaints_updated_at ON public.complaints;
CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. SEED — Owner account + subscription
-- ============================================================
INSERT INTO public.auth_users (name, email, provider, role, product_access)
VALUES ('Shashank Pasikanti', 'pasikantishashank24@gmail.com', 'google', 'owner', ARRAY['recruit','analytics','admin'])
ON CONFLICT (email) DO UPDATE
  SET role           = 'owner',
      product_access = ARRAY['recruit','analytics','admin'],
      updated_at     = NOW();

-- Auto-provision free subscriptions for all users without one
INSERT INTO public.subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
  SELECT id, 'free', 'active', 'monthly', 0, 'usd'
  FROM   public.auth_users
  WHERE  id NOT IN (SELECT user_id FROM public.subscriptions)
  ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- ── Helper: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auth_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  email           TEXT        UNIQUE NOT NULL,
  image           TEXT,
  provider        TEXT        NOT NULL DEFAULT 'google',
  provider_id     TEXT,
  role            TEXT        NOT NULL DEFAULT 'user',   -- 'user' | 'owner' | 'admin'
  product_access  TEXT[]      NOT NULL DEFAULT ARRAY['recruit'],
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_users_email_idx    ON public.auth_users (email);
CREATE INDEX IF NOT EXISTS auth_users_provider_idx ON public.auth_users (provider, provider_id);
CREATE INDEX IF NOT EXISTS auth_users_role_idx     ON public.auth_users (role);

DROP TRIGGER IF EXISTS auth_users_updated_at ON public.auth_users;
CREATE TRIGGER auth_users_updated_at
  BEFORE UPDATE ON public.auth_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.auth_users;
CREATE POLICY "service_role_all" ON public.auth_users USING (true);

-- ============================================================
-- 2. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  plan            TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  status          TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'past_due' | 'cancelled' | 'trialing'
  billing_cycle   TEXT        NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
  amount_cents    INTEGER     NOT NULL DEFAULT 0,
  currency        TEXT        NOT NULL DEFAULT 'usd',
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  payment_method  TEXT,
  stripe_sub_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx   ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.subscriptions;
CREATE POLICY "service_role_all" ON public.subscriptions USING (true);

-- ============================================================
-- 3. JOB POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  company         TEXT,
  location        TEXT,
  type            TEXT        DEFAULT 'full-time', -- 'full-time' | 'part-time' | 'contract' | 'remote'
  description     TEXT,
  requirements    TEXT,
  salary_min      INTEGER,
  salary_max      INTEGER,
  currency        TEXT        DEFAULT 'USD',
  status          TEXT        NOT NULL DEFAULT 'active', -- 'draft' | 'active' | 'closed' | 'archived'
  applications_count INTEGER  NOT NULL DEFAULT 0,
  ai_generated    BOOLEAN     NOT NULL DEFAULT FALSE,
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_posts_user_idx   ON public.job_posts (user_id);
CREATE INDEX IF NOT EXISTS job_posts_status_idx ON public.job_posts (status);
CREATE INDEX IF NOT EXISTS job_posts_created_idx ON public.job_posts (created_at DESC);

DROP TRIGGER IF EXISTS job_posts_updated_at ON public.job_posts;
CREATE TRIGGER job_posts_updated_at
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.job_posts;
CREATE POLICY "service_role_all" ON public.job_posts USING (true);

-- ============================================================
-- 4. RESUMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.resumes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  candidate_name  TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  file_name       TEXT,
  file_url        TEXT,          -- public storage URL
  file_size_bytes INTEGER,
  raw_text        TEXT,          -- extracted plain text
  ai_score        NUMERIC(5,2),  -- 0-100 AI fit score
  ai_summary      TEXT,          -- AI-generated summary
  ai_skills       TEXT[],        -- extracted skills
  status          TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'screened' | 'shortlisted' | 'rejected' | 'hired'
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resumes_user_idx     ON public.resumes (user_id);
CREATE INDEX IF NOT EXISTS resumes_job_idx      ON public.resumes (job_post_id);
CREATE INDEX IF NOT EXISTS resumes_status_idx   ON public.resumes (status);
CREATE INDEX IF NOT EXISTS resumes_score_idx    ON public.resumes (ai_score DESC);
CREATE INDEX IF NOT EXISTS resumes_email_idx    ON public.resumes (candidate_email);

DROP TRIGGER IF EXISTS resumes_updated_at ON public.resumes;
CREATE TRIGGER resumes_updated_at
  BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.resumes;
CREATE POLICY "service_role_all" ON public.resumes USING (true);

-- ============================================================
-- 5. TOKEN USAGE (AI API calls tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.token_usage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  model           TEXT        NOT NULL DEFAULT 'gpt-4',
  operation       TEXT        NOT NULL, -- 'resume_screen' | 'job_generate' | 'bulk_screen' etc.
  prompt_tokens   INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER   NOT NULL DEFAULT 0,
  total_tokens    INTEGER     GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS token_usage_user_idx  ON public.token_usage (user_id);
CREATE INDEX IF NOT EXISTS token_usage_date_idx  ON public.token_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS token_usage_op_idx    ON public.token_usage (operation);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.token_usage;
CREATE POLICY "service_role_all" ON public.token_usage USING (true);

-- ============================================================
-- 6. ACTIVITY LOG (signup, login, errors, key events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL, -- 'signup' | 'login' | 'error' | 'upload' | 'subscription_change' etc.
  event_data      JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  severity        TEXT        NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error' | 'critical'
  notified        BOOLEAN     NOT NULL DEFAULT FALSE,  -- whether owner was notified
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_user_idx     ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_type_idx     ON public.activity_log (event_type);
CREATE INDEX IF NOT EXISTS activity_log_severity_idx ON public.activity_log (severity);
CREATE INDEX IF NOT EXISTS activity_log_date_idx     ON public.activity_log (created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.activity_log;
CREATE POLICY "service_role_all" ON public.activity_log USING (true);

-- ============================================================
-- 7. COMPLAINTS / SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  subject         TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved' | 'closed'
  priority        TEXT        NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS complaints_user_idx   ON public.complaints (user_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON public.complaints (status);

DROP TRIGGER IF EXISTS complaints_updated_at ON public.complaints;
CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.complaints;
CREATE POLICY "service_role_all" ON public.complaints USING (true);

-- ============================================================
-- 8. SEED — Owner account
-- Create/update the owner account so pasikantishashank24@gmail.com
-- always has role='owner' on every migration run.
-- ============================================================
INSERT INTO public.auth_users (name, email, provider, role, product_access)
VALUES ('Shashank Pasikanti', 'pasikantishashank24@gmail.com', 'google', 'owner', ARRAY['recruit','analytics','admin'])
ON CONFLICT (email) DO UPDATE
  SET role           = 'owner',
      product_access = ARRAY['recruit','analytics','admin'],
      updated_at     = NOW();

-- ============================================================
-- Verify
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
