-- ============================================================
-- Migration v6: ID & Date System Enhancements
-- Adds indexes for date filtering, short_id lookups, and
-- ensures last_contacted_at column exists on resumes.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- 1. Ensure short_id column exists on resumes (in case using earlier schema)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS short_id TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS short_id TEXT;

-- 2. Add last_contacted_at to resumes for communication tracking
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- 3. Indexes for date-range filtering on candidates
CREATE INDEX IF NOT EXISTS idx_resumes_created_at     ON resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_user_created   ON resumes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_posts_created_at   ON job_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_posts_user_created ON job_posts (user_id, created_at DESC);

-- 4. Indexes for short_id prefix search (pattern: CAN-000245)
CREATE INDEX IF NOT EXISTS idx_resumes_short_id   ON resumes   (short_id);
CREATE INDEX IF NOT EXISTS idx_job_posts_short_id ON job_posts (short_id);

-- 5. Backfill short_id for any existing resumes/jobs that are missing it
-- Resumes: uses existing sequence srp_resume_id_seq (RES-xxxxxx format)
-- Run only if there are NULL short_ids; sequence must already exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_name = 'srp_resume_id_seq'
  ) THEN
    UPDATE resumes
    SET short_id = 'RES-' || LPAD(nextval('srp_resume_id_seq')::text, 6, '0')
    WHERE short_id IS NULL OR short_id = '';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_name = 'srp_job_id_seq'
  ) THEN
    UPDATE job_posts
    SET short_id = 'JOB-' || LPAD(nextval('srp_job_id_seq')::text, 6, '0')
    WHERE short_id IS NULL OR short_id = '';
  END IF;
END$$;

-- 6. Index on communication_templates for quick template seeding check
CREATE INDEX IF NOT EXISTS idx_comm_templates_user ON communication_templates (user_id);

-- Done
SELECT 'Migration v6 complete' AS status;
