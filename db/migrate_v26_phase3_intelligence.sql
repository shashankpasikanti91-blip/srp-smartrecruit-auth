-- v26: Phase 3 Enterprise Intelligence & Agentic Recruitment OS

-- ── AI working memory (tenant-scoped conversation context) ──────────────────
ALTER TABLE public.coach_sessions
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS working_set JSONB NOT NULL DEFAULT '{"candidates":[],"jobs":[],"last_search":null}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_working_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  memory_key        TEXT NOT NULL DEFAULT 'default',
  context           JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_ids     UUID[] NOT NULL DEFAULT '{}',
  job_ids           UUID[] NOT NULL DEFAULT '{}',
  last_search       TEXT,
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, memory_key)
);

CREATE INDEX IF NOT EXISTS ai_memory_user_idx
  ON public.ai_working_memory (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS public.ai_saved_searches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  query             TEXT NOT NULL,
  filters           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Multi-dimensional AI fit scores ────────────────────────────────────────
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS ai_fit_scores JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.resumes.ai_fit_scores IS
  'Phase 3 scorecard: skill, experience, domain, location, notice, salary, communication, resume_quality, interview, overall';

-- ── Client 360 enrichment ───────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hiring_manager TEXT,
  ADD COLUMN IF NOT EXISTS contract_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revenue_ytd NUMERIC,
  ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE TABLE IF NOT EXISTS public.client_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  doc_type          TEXT DEFAULT 'contract',
  file_path         TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  scheduled_at      TIMESTAMPTZ,
  attendees         TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Job 360 enrichment ──────────────────────────────────────────────────────
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS hiring_manager TEXT,
  ADD COLUMN IF NOT EXISTS hiring_difficulty TEXT,
  ADD COLUMN IF NOT EXISTS salary_benchmark JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS market_insights JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Agent collaboration chains ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_collaborations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger_event     TEXT NOT NULL,
  entity_type       TEXT,
  entity_id         TEXT,
  resume_id         UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_post_id       UUID REFERENCES public.job_posts(id) ON DELETE SET NULL,
  chain             JSONB NOT NULL DEFAULT '[]'::jsonb,
  consolidated_title TEXT NOT NULL,
  consolidated_body TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'dismissed')),
  suggestion_ids    UUID[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES public.auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS agent_collab_pending_idx
  ON public.agent_collaborations (tenant_id, status, created_at DESC);

-- Link suggestions to collaboration
ALTER TABLE public.agent_suggestions
  ADD COLUMN IF NOT EXISTS collaboration_id UUID REFERENCES public.agent_collaborations(id) ON DELETE SET NULL;

-- ── Daily briefing cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_daily_briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  briefing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, briefing_date)
);
