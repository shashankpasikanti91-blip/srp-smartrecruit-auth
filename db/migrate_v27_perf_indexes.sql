-- v27: Performance indexes for large-tenant list / 360 / dashboard paths
-- Safe to re-run (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS resumes_tenant_stage_idx
  ON public.resumes (tenant_id, pipeline_stage);

CREATE INDEX IF NOT EXISTS resumes_tenant_match_idx
  ON public.resumes (tenant_id, match_category)
  WHERE match_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS resumes_tenant_created_idx
  ON public.resumes (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS resumes_tenant_job_idx
  ON public.resumes (tenant_id, job_post_id)
  WHERE job_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS offer_cases_tenant_joining_idx
  ON public.offer_cases (tenant_id, expected_joining)
  WHERE expected_joining IS NOT NULL;

CREATE INDEX IF NOT EXISTS offer_cases_tenant_updated_idx
  ON public.offer_cases (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS interviews_tenant_status_sched_idx
  ON public.interviews (tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS submissions_tenant_updated_idx
  ON public.submissions (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS candidate_documents_tenant_resume_idx
  ON public.candidate_documents (tenant_id, resume_id);

CREATE INDEX IF NOT EXISTS entity_timeline_tenant_created_idx
  ON public.entity_timeline (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (tenant_id, user_id, created_at DESC)
  WHERE is_read = false;
