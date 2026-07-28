-- v28: Append-only tenant-scoped entity notes (timeline / threaded notes)
CREATE TABLE IF NOT EXISTS entity_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL
                  CHECK (entity_type IN ('candidate', 'submission', 'interview', 'offer', 'follow_up', 'client')),
  entity_id       UUID NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN (
                    'recruiter', 'follow_up', 'internal', 'reviewer',
                    'client_feedback', 'general'
                  )),
  body            TEXT NOT NULL,
  author_user_id  UUID,
  author_email    TEXT,
  author_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_entity_notes_lookup
  ON entity_notes (tenant_id, entity_type, entity_id, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_entity_notes_author
  ON entity_notes (tenant_id, author_user_id, created_at DESC);

-- One-shot migrate legacy candidate profile note fields into timeline entries
INSERT INTO entity_notes (tenant_id, entity_type, entity_id, category, body, author_email, author_name, created_at)
SELECT
  r.tenant_id,
  'candidate',
  r.id,
  v.category,
  v.body,
  'system@migration',
  'Migrated note',
  COALESCE(r.updated_at, r.created_at, NOW())
FROM resumes r
CROSS JOIN LATERAL (
  VALUES
    ('recruiter', NULLIF(TRIM(r.candidate_profile->>'notes'), '')),
    ('follow_up', NULLIF(TRIM(r.candidate_profile->>'follow_up_notes'), '')),
    ('internal', NULLIF(TRIM(r.candidate_profile->>'internal_comments'), '')),
    ('reviewer', NULLIF(TRIM(r.reviewer_notes), ''))
) AS v(category, body)
WHERE r.tenant_id IS NOT NULL
  AND v.body IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM entity_notes en
    WHERE en.tenant_id = r.tenant_id
      AND en.entity_type = 'candidate'
      AND en.entity_id = r.id
      AND en.category = v.category
      AND en.author_email = 'system@migration'
  );
