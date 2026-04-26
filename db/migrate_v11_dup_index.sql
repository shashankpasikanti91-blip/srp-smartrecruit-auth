-- V11: Add index on resumes(tenant_id, candidate_email) to speed up duplicate checks
-- The index is non-unique (historical duplicates may exist), NULLS are excluded so
-- null emails never trigger false positives.

CREATE INDEX IF NOT EXISTS resumes_tenant_email_idx
  ON resumes (tenant_id, candidate_email)
  WHERE candidate_email IS NOT NULL;
