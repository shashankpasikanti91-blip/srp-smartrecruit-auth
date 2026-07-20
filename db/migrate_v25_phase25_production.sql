-- v25: Phase 2.5 Production Readiness — docs verify, workflow, agents, reports, country, comms

-- ── Document verification history ───────────────────────────────────────────
ALTER TABLE public.candidate_documents
  DROP CONSTRAINT IF EXISTS candidate_documents_verification_status_check;

-- Widen verification statuses (nullable-safe)
UPDATE public.candidate_documents
  SET verification_status = 'pending_verification'
  WHERE verification_status IS NULL OR verification_status IN ('unverified', '');

CREATE TABLE IF NOT EXISTS public.document_verification_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id       UUID NOT NULL REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
  resume_id         UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  user_email        TEXT,
  old_status        TEXT,
  new_status        TEXT NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doc_verify_hist_doc_idx
  ON public.document_verification_history (document_id, created_at DESC);

-- ── Communication log entity links ──────────────────────────────────────────
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS job_post_id UUID REFERENCES public.job_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_of UUID,
  ADD COLUMN IF NOT EXISTS thread_key TEXT;

CREATE INDEX IF NOT EXISTS comm_logs_job_idx ON public.communication_logs (job_post_id) WHERE job_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comm_logs_client_idx ON public.communication_logs (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comm_logs_thread_idx ON public.communication_logs (tenant_id, thread_key, created_at DESC)
  WHERE thread_key IS NOT NULL;

-- ── Workflow engine ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  resume_id         UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_post_id       UUID REFERENCES public.job_posts(id) ON DELETE SET NULL,
  stage             TEXT NOT NULL DEFAULT 'open',
  waiting_status    TEXT DEFAULT 'active',
  sla_due_at        TIMESTAMPTZ,
  escalation_level  INTEGER NOT NULL DEFAULT 0,
  required_docs     JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_status   TEXT DEFAULT 'none',
  ai_hint           TEXT,
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS workflow_sla_idx
  ON public.workflow_instances (tenant_id, sla_due_at)
  WHERE waiting_status = 'active';

CREATE TABLE IF NOT EXISTS public.workflow_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id       UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  from_stage        TEXT,
  to_stage          TEXT,
  actor_user_id     UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  actor_email       TEXT,
  detail            TEXT,
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_events_inst_idx
  ON public.workflow_events (instance_id, created_at DESC);

-- ── Agent framework (recommend only) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_type        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'completed',
  summary           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_type        TEXT NOT NULL,
  entity_type       TEXT,
  entity_id         TEXT,
  resume_id         UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_post_id       UUID REFERENCES public.job_posts(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  rationale         TEXT,
  draft_message     TEXT,
  draft_channel     TEXT DEFAULT 'email',
  draft_reminder    JSONB,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'dismissed')),
  run_id            UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES public.auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS agent_suggestions_pending_idx
  ON public.agent_suggestions (tenant_id, status, created_at DESC);

-- ── Report templates + schedule ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  report_type       TEXT NOT NULL,
  filters           JSONB NOT NULL DEFAULT '{}'::jsonb,
  format            TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx', 'pdf')),
  schedule_cron     TEXT,
  last_run_at       TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS report_templates_tenant_idx
  ON public.report_templates (tenant_id, is_active);

-- ── Country settings (multi-country packs) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.country_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  country_code      TEXT NOT NULL,
  default_currency  TEXT DEFAULT 'MYR',
  holidays          JSONB NOT NULL DEFAULT '[]'::jsonb,
  payroll_defaults  JSONB NOT NULL DEFAULT '{}'::jsonb,
  visa_rules        JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, country_code)
);

-- ── Coach sessions (multi-turn) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL DEFAULT 'New chat',
  messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_sessions_user_idx
  ON public.coach_sessions (tenant_id, user_id, updated_at DESC);

-- Widen hr_templates types for country packs (drop check if restrictive)
ALTER TABLE public.hr_templates DROP CONSTRAINT IF EXISTS hr_templates_template_type_check;
ALTER TABLE public.hr_templates
  ADD CONSTRAINT hr_templates_template_type_check CHECK (template_type IN (
    'email', 'whatsapp', 'offer', 'interview', 'checklist', 'document', 'country',
    'offer_letter', 'joining_checklist', 'employment_contract', 'visa_requirements'
  ));
