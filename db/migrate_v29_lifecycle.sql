-- v29: Canonical recruitment lifecycle (P1)
-- Single source of truth: resumes.pipeline_stage stores canonical stages;
-- lifecycle_events is the append-only history.

CREATE TABLE IF NOT EXISTS lifecycle_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resume_id         UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_post_id       UUID REFERENCES job_posts(id) ON DELETE SET NULL,
  from_stage        TEXT,
  to_stage          TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  actor_user_id     UUID,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_resume
  ON lifecycle_events (tenant_id, resume_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_job
  ON lifecycle_events (tenant_id, job_post_id, created_at DESC)
  WHERE job_post_id IS NOT NULL;

-- Backfill: map legacy hired → joined for display consistency going forward
-- (do not rewrite history rows; only normalize current stage where exact match)
UPDATE resumes
SET pipeline_stage = 'joined'
WHERE pipeline_stage = 'hired';

-- Seed one synthetic event per resume that has no lifecycle_events yet
INSERT INTO lifecycle_events (tenant_id, resume_id, job_post_id, from_stage, to_stage, reason)
SELECT r.tenant_id, r.id, r.job_post_id, NULL, COALESCE(NULLIF(r.pipeline_stage, ''), 'sourced'), 'backfill_v29'
FROM resumes r
WHERE r.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lifecycle_events e WHERE e.resume_id = r.id
  );
