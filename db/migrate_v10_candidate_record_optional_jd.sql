-- =============================================================================
-- Migration v10 — May 2026 (SmartRecruit Next.js / PostgreSQL)
-- =============================================================================
-- Adds:
--   1. resumes.candidate_profile JSONB — recruiter-maintained dossier (salary,
--      notice, location, visa, India PAN / Aadhaar ref, IDs, notes). Tenant-scoped.
--   2. job_posts.optional_requirements TEXT — nice-to-have skills; appended to
--      AI screening when job_post_id is linked (see /api/screen).
--
-- Prerequisite: prior migrations (multitenant, ai_screening_data, etc.) applied.
-- Apply: psql $DATABASE_URL -f db/migrate_v10_candidate_record_optional_jd.sql
-- =============================================================================

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS candidate_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.resumes.candidate_profile IS
  'Tenant-scoped recruiter fields: compensation, notice, location, visa, masked IDs — never cross-tenant.';

CREATE INDEX IF NOT EXISTS idx_resumes_candidate_profile
  ON public.resumes USING GIN (candidate_profile)
  WHERE candidate_profile IS NOT NULL AND candidate_profile <> '{}'::jsonb;

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS optional_requirements TEXT;

COMMENT ON COLUMN public.job_posts.optional_requirements IS
  'Nice-to-have skills / optional criteria — merged into AI screening when job is linked.';
