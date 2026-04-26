-- Migration v7: Add ai_screening_data JSONB column to resumes table
-- This stores the full structured AI screening result so it never needs to be re-run.
-- The score badge in candidate modal becomes clickable to show the full breakdown.

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS ai_screening_data JSONB;

-- Index for faster JSONB queries if needed in future
CREATE INDEX IF NOT EXISTS idx_resumes_ai_screening_data ON resumes USING GIN (ai_screening_data)
  WHERE ai_screening_data IS NOT NULL;
