-- v34: Persist original JD upload (PDF/DOCX/TXT) alongside raw_jd_text
ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS jd_original_path TEXT,
  ADD COLUMN IF NOT EXISTS jd_original_name TEXT,
  ADD COLUMN IF NOT EXISTS jd_original_mime TEXT;

COMMENT ON COLUMN job_posts.jd_original_path IS 'Relative path under uploads/job-jd-originals for original JD binary';
COMMENT ON COLUMN job_posts.jd_original_name IS 'Original uploaded filename';
COMMENT ON COLUMN job_posts.jd_original_mime IS 'MIME type of original JD file';
