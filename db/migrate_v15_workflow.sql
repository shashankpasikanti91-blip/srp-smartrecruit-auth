-- v15: Submissions, follow-ups, offer cases

CREATE TABLE IF NOT EXISTS public.submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resume_id         UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  job_post_id       UUID REFERENCES public.job_posts(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  short_id          TEXT UNIQUE,
  client_name       TEXT,
  applying_for      TEXT,
  hire_type         TEXT,
  stage             TEXT NOT NULL DEFAULT 'draft' CHECK (stage IN (
    'draft', 'submitted', 'client_review', 'shortlisted', 'interview',
    'offer', 'joined', 'rejected', 'hold'
  )),
  lifecycle_status  TEXT,
  submission_date   DATE,
  feedback          JSONB DEFAULT '{}'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submissions_tenant_idx ON public.submissions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_resume_idx ON public.submissions (resume_id);
CREATE INDEX IF NOT EXISTS submissions_stage_idx ON public.submissions (tenant_id, stage);

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resume_id       UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  submission_id   UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'call' CHECK (channel IN (
    'call', 'whatsapp', 'email', 'meeting', 'other'
  )),
  title           TEXT NOT NULL,
  notes           TEXT,
  due_at          TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'done', 'cancelled', 'snoozed'
  )),
  candidate_response TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS follow_ups_tenant_due_idx ON public.follow_ups (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS follow_ups_user_due_idx ON public.follow_ups (user_id, due_at);

CREATE TABLE IF NOT EXISTS public.offer_cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resume_id         UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  submission_id     UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'offer_released' CHECK (status IN (
    'offer_released', 'offer_accepted', 'offer_rejected', 'salary_negotiation',
    'joining_confirmed', 'joined', 'onboarding', 'cancelled'
  )),
  offer_salary      TEXT,
  expected_joining  DATE,
  employment_type   TEXT,
  hr_checklist      JSONB DEFAULT '{}'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_cases_tenant_idx ON public.offer_cases (tenant_id, status);
