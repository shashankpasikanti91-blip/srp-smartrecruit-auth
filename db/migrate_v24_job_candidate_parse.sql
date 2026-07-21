-- v24: Job create / parse enrichment fields

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headcount INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS candidate_type TEXT DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS jd_received_date DATE,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS target_cv_submissions INTEGER,
  ADD COLUMN IF NOT EXISTS internal_sla_days INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS target_submission_date DATE,
  ADD COLUMN IF NOT EXISTS share_jd_with_client BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_jd_text TEXT,
  ADD COLUMN IF NOT EXISTS contract_duration TEXT,
  ADD COLUMN IF NOT EXISTS max_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS client_jr_no TEXT,
  ADD COLUMN IF NOT EXISTS skills_mandatory TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_required TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_recruiter_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assign_all_team BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS job_meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS job_posts_client_id_idx ON public.job_posts (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_posts_priority_idx ON public.job_posts (tenant_id, priority);
