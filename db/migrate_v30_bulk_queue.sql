-- v30: Bulk screening queue (P5)
CREATE TABLE IF NOT EXISTS bulk_screening_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_post_id   UUID REFERENCES job_posts(id) ON DELETE SET NULL,
  created_by    UUID,
  status        TEXT NOT NULL DEFAULT 'queued',
  total         INT NOT NULL DEFAULT 0,
  completed     INT NOT NULL DEFAULT 0,
  failed        INT NOT NULL DEFAULT 0,
  skipped       INT NOT NULL DEFAULT 0,
  eta_seconds   INT,
  error_summary TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_screening_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_job_id     UUID NOT NULL REFERENCES bulk_screening_jobs(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  file_name       TEXT,
  resume_text     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  candidate_id    UUID,
  error           TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  result_json     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_tenant ON bulk_screening_jobs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_items_job ON bulk_screening_items (bulk_job_id, status);
