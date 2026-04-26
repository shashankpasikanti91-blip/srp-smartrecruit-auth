-- ============================================================
-- Migration v8c: Final production hardening
-- Consolidates all remaining schema changes for multi-tenant
-- security, the new integrations slug model, AI scoring fields,
-- and job_posts tenant_id inline insert support.
--
-- Run AFTER migrate_v8b_patch.sql.
-- Safe to re-run (all statements are idempotent).
-- ============================================================
BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. integrations table — replace (user_id, provider) UNIQUE
--    with (tenant_id, slug) UNIQUE to match integrations/route.ts
-- ────────────────────────────────────────────────────────────

-- Create table fresh if it doesn't exist with the new schema
CREATE TABLE IF NOT EXISTS public.integrations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  slug        TEXT        NOT NULL,        -- e.g. 'openai', 'n8n', 'slack'
  label       TEXT,
  api_key_enc TEXT,                        -- AES-256-GCM encrypted
  webhook_url TEXT,
  config      JSONB       NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add tenant_id column to existing table if the table existed before
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS label TEXT;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS api_key_enc TEXT;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';

-- Migrate pre-existing rows: copy provider → slug, user tenant mapping
DO $$
BEGIN
  -- Only run if provider column exists (old schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'provider'
  ) THEN
    -- Copy provider value into slug where slug is NULL
    UPDATE public.integrations SET slug = provider WHERE slug IS NULL;

    -- Copy api_key_encrypted → api_key_enc (base64 → keep as is)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'api_key_encrypted'
    ) THEN
      UPDATE public.integrations
        SET api_key_enc = api_key_encrypted
        WHERE api_key_enc IS NULL AND api_key_encrypted IS NOT NULL;
    END IF;

    -- Attempt to map user_id → tenant_id via tenant_members for orphan rows
    UPDATE public.integrations i
      SET tenant_id = tm.tenant_id
      FROM public.tenant_members tm
      WHERE tm.user_id = i.user_id
        AND i.tenant_id IS NULL
        AND tm.role = 'owner';
  END IF;
END $$;

-- Make slug NOT NULL after backfill (set a default if still NULL)
UPDATE public.integrations SET slug = 'unknown' WHERE slug IS NULL;
ALTER TABLE public.integrations ALTER COLUMN slug SET NOT NULL;

-- Drop old UNIQUE constraint if it exists
DO $$ BEGIN
  ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_id_provider_key;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_provider_unique;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add new UNIQUE constraint (one integration slug per tenant)
DO $$ BEGIN
  ALTER TABLE public.integrations
    ADD CONSTRAINT integrations_tenant_slug_uq UNIQUE (tenant_id, slug);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

-- Index
CREATE INDEX IF NOT EXISTS integrations_tenant_idx ON public.integrations (tenant_id);

-- ────────────────────────────────────────────────────────────
-- 2. job_posts — ensure tenant_id column exists
--    (v8_multitenant may have added it; this is a safety guard)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_posts_tenant_idx ON public.job_posts (tenant_id);

-- ────────────────────────────────────────────────────────────
-- 3. resumes — new AI audit result columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS classification  TEXT;
  -- 'STRONG' | 'KAV' | 'REJECT'

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS recommendation  TEXT;
  -- 'Hire' | 'Hold' | 'Reject'

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS audit_data      JSONB;
  -- Full structured audit JSON from the AI (new schema)

-- ────────────────────────────────────────────────────────────
-- 4. api_keys — ensure table exists for profile/route.ts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  key_hash    TEXT        NOT NULL UNIQUE,
  key_prefix  TEXT        NOT NULL,
  label       TEXT        NOT NULL DEFAULT 'Default',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON public.api_keys (user_id);

-- ────────────────────────────────────────────────────────────
-- 5. resumes — ensure match_category column exists
--    (used by candidates/[id]/route.ts RETURNING clause)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS match_category TEXT;
  -- 'STRONG' | 'KAV' | 'REJECT' | null

-- ────────────────────────────────────────────────────────────
-- 6. token_usage — ensure tenant_id column exists
--    (used by tenant/route.ts usage stats)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.token_usage
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS token_usage_tenant_idx ON public.token_usage (tenant_id);

-- ────────────────────────────────────────────────────────────
-- 7. Update updated_at trigger for integrations
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS integrations_updated_at ON public.integrations;
CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
