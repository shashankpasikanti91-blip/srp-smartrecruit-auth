-- v12: Persist original resume files for in-app preview (PDF/DOCX/TXT)
-- Safe to run multiple times.
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS resume_original_path TEXT;

COMMENT ON COLUMN public.resumes.resume_original_path IS
  'Relative path under uploads/candidate-resumes/ (tenant-scoped filename); null if only extracted text was stored.';
