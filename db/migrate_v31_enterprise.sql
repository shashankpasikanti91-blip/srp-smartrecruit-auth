-- v31: Enterprise enhancements — ownership history, notes engine, job entity notes
-- Run: psql "$DATABASE_URL" -f nextjs-auth/db/migrate_v31_enterprise.sql

-- ── Entity notes: pin, visibility, mentions, attachments, edit tracking ─────
ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team';
ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_notes_visibility_check'
  ) THEN
    ALTER TABLE entity_notes ADD CONSTRAINT entity_notes_visibility_check
      CHECK (visibility IN ('private', 'team'));
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Extend entity_type to include job (drop/recreate check if present)
DO $$
BEGIN
  ALTER TABLE entity_notes DROP CONSTRAINT IF EXISTS entity_notes_entity_type_check;
  ALTER TABLE entity_notes ADD CONSTRAINT entity_notes_entity_type_check
    CHECK (entity_type IN (
      'candidate', 'submission', 'interview', 'offer', 'follow_up', 'client', 'job'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_entity_notes_pinned
  ON entity_notes (tenant_id, entity_type, entity_id, is_pinned DESC, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_entity_notes_visibility
  ON entity_notes (tenant_id, entity_type, entity_id, visibility, created_at DESC)
  WHERE is_deleted = FALSE;

-- ── Ownership records (current assignment) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ownership_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type       TEXT NOT NULL
                    CHECK (entity_type IN ('candidate', 'job', 'client', 'submission')),
  entity_id         UUID NOT NULL,
  owner_user_id     UUID NOT NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until       TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'transferred', 'archived')),
  transfer_reason   TEXT,
  approved_by       UUID,
  previous_owner_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_active_entity
  ON ownership_records (tenant_id, entity_type, entity_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ownership_owner
  ON ownership_records (tenant_id, owner_user_id, valid_until)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ownership_expiry
  ON ownership_records (tenant_id, valid_until)
  WHERE status = 'active';

-- ── Ownership history (immutable audit trail) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ownership_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ownership_record_id UUID REFERENCES ownership_records(id) ON DELETE SET NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID NOT NULL,
  from_user_id        UUID,
  to_user_id          UUID,
  action              TEXT NOT NULL
                      CHECK (action IN ('assign', 'extend', 'transfer', 'archive', 'expire')),
  reason              TEXT,
  approved_by         UUID,
  actor_user_id       UUID,
  meta                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ownership_history_entity
  ON ownership_history (tenant_id, entity_type, entity_id, created_at DESC);

-- Resume hash index for duplicate detection (nullable — backfill optional)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_resumes_content_hash
  ON resumes (tenant_id, resume_content_hash)
  WHERE resume_content_hash IS NOT NULL AND resume_content_hash <> '';

CREATE INDEX IF NOT EXISTS idx_resumes_phone
  ON resumes (tenant_id, candidate_phone)
  WHERE candidate_phone IS NOT NULL AND candidate_phone <> '';

CREATE INDEX IF NOT EXISTS idx_resumes_linkedin
  ON resumes ((candidate_profile->>'linkedin_url'))
  WHERE candidate_profile->>'linkedin_url' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resumes_passport
  ON resumes ((candidate_profile->>'passport_number'))
  WHERE candidate_profile->>'passport_number' IS NOT NULL;
