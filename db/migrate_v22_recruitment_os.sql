-- v22: Recruitment OS — expanded workflow statuses, interview round, follow-up source, doc templates

-- Submissions: widen stage CHECK (legacy + OS statuses)
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_stage_check;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_stage_check CHECK (stage IN (
    'draft', 'submitted', 'client_review', 'shortlisted', 'interview',
    'interview_completed', 'waiting_feedback', 'selected',
    'offer', 'offer_released', 'offer_accepted', 'offer_declined',
    'joined', 'rejected', 'rejected_by_candidate', 'duplicate',
    'position_closed', 'hold', 'submission_withdrawn', 'no_show'
  ));

-- Offer cases: OS onboarding stages + keep legacy
ALTER TABLE public.offer_cases DROP CONSTRAINT IF EXISTS offer_cases_status_check;

-- Normalize any bad legacy UI values already stored (while unconstrained)
UPDATE public.offer_cases SET status = 'salary_negotiation' WHERE status = 'negotiation';
UPDATE public.offer_cases SET status = 'offer_accepted' WHERE status = 'accepted';
UPDATE public.offer_cases SET status = 'offer_rejected' WHERE status IN ('declined', 'offer_declined');
UPDATE public.offer_cases SET status = 'cancelled' WHERE status = 'withdrawn';

ALTER TABLE public.offer_cases
  ADD CONSTRAINT offer_cases_status_check CHECK (status IN (
    'selected', 'document_collection', 'document_verification',
    'offer_draft', 'offer_released', 'offer_signed', 'salary_negotiation',
    'offer_accepted', 'offer_rejected', 'joining_confirmed', 'joining_followup',
    'joined', 'background_verification', 'probation', 'onboarding',
    'completed', 'dropped', 'no_show', 'cancelled'
  ));

-- Interviews: round + widen status if constraint exists
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kuala_Lumpur';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_status_check'
  ) THEN
    ALTER TABLE public.interviews DROP CONSTRAINT interviews_status_check;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_status_check CHECK (status IN (
    'scheduled', 'rescheduled', 'postponed', 'confirmed', 'completed',
    'no_show', 'interviewer_no_show', 'cancelled', 'rejected', 'selected',
    'awaiting_feedback', 'offer_discussion', 'offer_released',
    'offer_accepted', 'offer_rejected'
  ));

-- Follow-ups: source for auto engine
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS offer_case_id UUID REFERENCES public.offer_cases(id) ON DELETE SET NULL;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS interview_id UUID;

-- Configurable document checklist templates (HR Admin)
CREATE TABLE IF NOT EXISTS public.document_checklist_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  country_code      TEXT NOT NULL,
  employment_type   TEXT NOT NULL DEFAULT 'local' CHECK (employment_type IN ('local', 'foreign')),
  items             JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, country_code, employment_type)
);

CREATE INDEX IF NOT EXISTS doc_checklist_tenant_idx
  ON public.document_checklist_templates (tenant_id, country_code);
