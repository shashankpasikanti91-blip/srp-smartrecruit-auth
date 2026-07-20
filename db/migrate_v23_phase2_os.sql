-- v23: Phase 2 Recruitment OS — timeline, audit depth, offers, docs, reminders, notifications, templates

-- ── Audit log enrichment ────────────────────────────────────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_value TEXT,
  ADD COLUMN IF NOT EXISTS new_value TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS module TEXT;

CREATE INDEX IF NOT EXISTS audit_logs_tenant_module_idx
  ON public.audit_logs (tenant_id, module, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── Entity timeline events (auto-written, no manual entry) ──────────────────
CREATE TABLE IF NOT EXISTS public.entity_timeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  resume_id       UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  title           TEXT NOT NULL,
  detail          TEXT,
  actor_user_id   UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  actor_email     TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entity_timeline_resume_idx
  ON public.entity_timeline (tenant_id, resume_id, created_at DESC)
  WHERE resume_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS entity_timeline_entity_idx
  ON public.entity_timeline (tenant_id, entity_type, entity_id, created_at DESC);

-- ── Offer management expansion ──────────────────────────────────────────────
ALTER TABLE public.offer_cases
  ADD COLUMN IF NOT EXISTS short_id TEXT,
  ADD COLUMN IF NOT EXISTS offer_draft TEXT,
  ADD COLUMN IF NOT EXISTS salary_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS benefits TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS offer_expiry DATE,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by TEXT,
  ADD COLUMN IF NOT EXISTS counter_offer_notes TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'MY',
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none';

CREATE UNIQUE INDEX IF NOT EXISTS offer_cases_short_id_uidx
  ON public.offer_cases (short_id) WHERE short_id IS NOT NULL;

-- ── Document center enrichment ──────────────────────────────────────────────
ALTER TABLE public.candidate_documents
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Widen slot_type beyond original CHECK (drop + recreate permissive)
ALTER TABLE public.candidate_documents DROP CONSTRAINT IF EXISTS candidate_documents_slot_type_check;

CREATE UNIQUE INDEX IF NOT EXISTS candidate_documents_short_id_uidx
  ON public.candidate_documents (short_id) WHERE short_id IS NOT NULL;

-- ── Communication log enrichment (Email / WhatsApp Center) ──────────────────
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS attachment_paths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT,
  ADD COLUMN IF NOT EXISTS message_type TEXT;

-- ── HR Admin configurable templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_type   TEXT NOT NULL CHECK (template_type IN (
    'email', 'whatsapp', 'offer', 'interview', 'checklist', 'document', 'country'
  )),
  name            TEXT NOT NULL,
  subject         TEXT,
  body            TEXT,
  country_code    TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_templates_tenant_type_idx
  ON public.hr_templates (tenant_id, template_type, is_active);

-- ── Reminder rules (configurable engine) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminder_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_key        TEXT NOT NULL,
  label           TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  offset_minutes  INTEGER NOT NULL DEFAULT 0,
  channel         TEXT NOT NULL DEFAULT 'in_app',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, rule_key)
);

-- ── In-app notification center ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'general',
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,
  entity_type     TEXT,
  entity_id       TEXT,
  resume_id       UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, is_read, created_at DESC);

-- Seed default reminder rules for existing tenants (idempotent via ON CONFLICT)
INSERT INTO public.reminder_rules (tenant_id, rule_key, label, entity_type, offset_minutes, channel)
SELECT t.id, r.rule_key, r.label, r.entity_type, r.offset_minutes, 'in_app'
FROM public.tenants t
CROSS JOIN (VALUES
  ('interview_1d', 'Interview — 1 day before', 'interview', -1440),
  ('interview_2h', 'Interview — 2 hours before', 'interview', -120),
  ('interview_30m', 'Interview — 30 minutes before', 'interview', -30),
  ('joining_7d', 'Joining — 7 days before', 'offer', -10080),
  ('joining_3d', 'Joining — 3 days before', 'offer', -4320),
  ('joining_1d', 'Joining — 1 day before', 'offer', -1440),
  ('joining_day', 'Joining day', 'offer', 0),
  ('docs_missing', 'Missing documents', 'document', 0),
  ('visa_expiry_30d', 'Visa expiry — 30 days', 'candidate', -43200),
  ('passport_expiry_30d', 'Passport expiry — 30 days', 'candidate', -43200),
  ('probation_end', 'Probation end', 'employee', 0),
  ('contract_renewal', 'Contract renewal', 'employee', -43200),
  ('birthday', 'Birthday', 'employee', 0),
  ('work_anniversary', 'Work anniversary', 'employee', 0),
  ('review_date', 'Review date', 'employee', -10080)
) AS r(rule_key, label, entity_type, offset_minutes)
ON CONFLICT (tenant_id, rule_key) DO NOTHING;
