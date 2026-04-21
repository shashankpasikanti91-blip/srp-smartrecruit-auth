-- ============================================================
-- SRP AI Labs SmartRecruit — Enterprise Migration v5
-- Phase 2-4: Integration Hub, Communication, Webhooks, Import,
--            JD Intelligence, Boolean Search, Audit Logs
-- Safe to run multiple times (all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
--
-- Apply:
--   docker exec srp-auth-db psql -U srp_auth -d srp_auth \
--     -f /migrate_v5_enterprise.sql
-- ============================================================

-- ── Helper (idempotent) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ============================================================
-- 1. ROLES EXTENSION
--    Extend existing auth_users with additional enterprise roles
-- ============================================================
-- Add role_level for finer-grained RBAC without breaking current 'role' column
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS role_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (role_level IN ('super_admin','org_owner','admin','recruiter',
                          'hiring_manager','viewer','restricted','standard'));

ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

-- ============================================================
-- 2. AUDIT LOGS
--    Every important action written here
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.auth_users(id) ON DELETE SET NULL,
  user_email      TEXT,
  action          TEXT        NOT NULL,
  resource_type   TEXT        NOT NULL,
  resource_id     TEXT,
  details         JSONB       DEFAULT '{}'::jsonb,
  ip_address      INET,
  user_agent      TEXT,
  result          TEXT        NOT NULL DEFAULT 'success'
                    CHECK (result IN ('success','failure','partial','validation_error')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx     ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx   ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON public.audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx  ON public.audit_logs (created_at DESC);

-- ============================================================
-- 3. INTEGRATIONS (connector registry)
--    One row per configured connector per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,   -- 'naukri','indeed','n8n','sendgrid' etc.
  category        TEXT        NOT NULL    -- 'job_portal','email','messaging','automation','storage','crm'
                    CHECK (category IN (
                      'job_portal','email','messaging','automation',
                      'storage','crm','hrms','custom'
                    )),
  status          TEXT        NOT NULL DEFAULT 'inactive'
                    CHECK (status IN ('active','inactive','error','pending','revoked')),
  auth_method     TEXT        NOT NULL DEFAULT 'api_key'
                    CHECK (auth_method IN (
                      'api_key','oauth','webhook','manual_token',
                      'sftp','csv_import','service_account','custom'
                    )),
  mode            TEXT        NOT NULL DEFAULT 'manual'
                    CHECK (mode IN ('live','manual','assisted','coming_soon')),
  direction       TEXT        NOT NULL DEFAULT 'outbound'
                    CHECK (direction IN ('inbound','outbound','bidirectional')),
  webhook_url     TEXT,
  scopes          TEXT[]      DEFAULT '{}',
  config          JSONB       DEFAULT '{}'::jsonb,
  last_sync_at    TIMESTAMPTZ,
  last_error      TEXT,
  error_count     INTEGER     NOT NULL DEFAULT 0,
  is_template     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT integrations_user_slug_uq UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS integrations_user_idx     ON public.integrations (user_id);
CREATE INDEX IF NOT EXISTS integrations_status_idx   ON public.integrations (status);
CREATE INDEX IF NOT EXISTS integrations_category_idx ON public.integrations (category);

DROP TRIGGER IF EXISTS integrations_updated_at ON public.integrations;
CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. CONNECTOR CREDENTIALS (encrypted secrets)
--    Secrets stored separately from config; never returned in full
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connector_credentials (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id      UUID        NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  credential_type     TEXT        NOT NULL,        -- 'api_key','access_token','client_secret',...
  encrypted_value     TEXT        NOT NULL,        -- AES-256 encrypted
  key_hint            TEXT,                        -- last 4 chars shown in UI
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  rotated_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credentials_integration_idx ON public.connector_credentials (integration_id);
CREATE INDEX IF NOT EXISTS credentials_user_idx        ON public.connector_credentials (user_id);

DROP TRIGGER IF EXISTS credentials_updated_at ON public.connector_credentials;
CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON public.connector_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. CONNECTOR SYNC LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connector_sync_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID        NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  direction       TEXT        NOT NULL CHECK (direction IN ('push','pull','test')),
  status          TEXT        NOT NULL CHECK (status IN ('running','success','partial','failed','aborted')),
  records_total   INTEGER     DEFAULT 0,
  records_ok      INTEGER     DEFAULT 0,
  records_failed  INTEGER     DEFAULT 0,
  error_detail    TEXT,
  payload         JSONB       DEFAULT '{}'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS sync_logs_integration_idx ON public.connector_sync_logs (integration_id);
CREATE INDEX IF NOT EXISTS sync_logs_user_idx        ON public.connector_sync_logs (user_id);
CREATE INDEX IF NOT EXISTS sync_logs_status_idx      ON public.connector_sync_logs (status);
CREATE INDEX IF NOT EXISTS sync_logs_started_idx     ON public.connector_sync_logs (started_at DESC);

-- ============================================================
-- 6. COMMUNICATION PROVIDERS
--    Email / WhatsApp / Telegram channel configs per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_providers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL
                    CHECK (channel IN ('email','gmail','outlook','whatsapp','telegram','sms','custom')),
  provider_name   TEXT        NOT NULL,   -- 'sendgrid','smtp','mailgun','twilio','meta',...
  is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  config          JSONB       DEFAULT '{}'::jsonb,
  test_passed     BOOLEAN,
  last_tested_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comm_providers_user_channel_uq UNIQUE (user_id, channel, provider_name)
);

CREATE INDEX IF NOT EXISTS comm_providers_user_idx    ON public.communication_providers (user_id);
CREATE INDEX IF NOT EXISTS comm_providers_channel_idx ON public.communication_providers (channel);

DROP TRIGGER IF EXISTS comm_providers_updated_at ON public.communication_providers;
CREATE TRIGGER comm_providers_updated_at
  BEFORE UPDATE ON public.communication_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. COMMUNICATION TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  channel         TEXT        NOT NULL CHECK (channel IN ('email','whatsapp','telegram','sms','all')),
  purpose         TEXT        NOT NULL
                    CHECK (purpose IN (
                      'interview_invite','shortlist','rejection','follow_up',
                      'offer','reminder','welcome','custom'
                    )),
  subject         TEXT,
  body_template   TEXT        NOT NULL,
  variables       TEXT[]      DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comm_templates_user_idx ON public.communication_templates (user_id);
CREATE INDEX IF NOT EXISTS comm_templates_channel_idx ON public.communication_templates (channel, purpose);

DROP TRIGGER IF EXISTS comm_templates_updated_at ON public.communication_templates;
CREATE TRIGGER comm_templates_updated_at
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. COMMUNICATION LOGS
--    Every sent message stored here
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  provider_id     UUID        REFERENCES public.communication_providers(id) ON DELETE SET NULL,
  template_id     UUID        REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  channel         TEXT        NOT NULL,
  recipient       TEXT        NOT NULL,
  subject         TEXT,
  body_preview    TEXT,   -- first 500 chars only — no full PII in logs
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','failed','bounced','skipped')),
  error_message   TEXT,
  external_id     TEXT,   -- provider's message ID
  retry_count     INTEGER NOT NULL DEFAULT 0,
  resource_type   TEXT,   -- 'resume','job_post','interview_invite'
  resource_id     TEXT,
  metadata        JSONB   DEFAULT '{}'::jsonb,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comm_logs_user_idx      ON public.communication_logs (user_id);
CREATE INDEX IF NOT EXISTS comm_logs_channel_idx   ON public.communication_logs (channel);
CREATE INDEX IF NOT EXISTS comm_logs_status_idx    ON public.communication_logs (status);
CREATE INDEX IF NOT EXISTS comm_logs_created_idx   ON public.communication_logs (created_at DESC);

-- ============================================================
-- 9. WEBHOOK SUBSCRIPTIONS (outbound)
--    Users register URLs to receive system events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  target_url      TEXT        NOT NULL,
  secret          TEXT        NOT NULL,   -- stored encrypted; used for HMAC signature
  events          TEXT[]      NOT NULL DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  verify_ssl      BOOLEAN     NOT NULL DEFAULT TRUE,
  timeout_seconds INTEGER     NOT NULL DEFAULT 10,
  retry_max       INTEGER     NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  failure_count   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_user_idx   ON public.webhook_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON public.webhook_subscriptions (is_active);

DROP TRIGGER IF EXISTS webhooks_updated_at ON public.webhook_subscriptions;
CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 10. WEBHOOK DELIVERY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID        NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  attempt         INTEGER     NOT NULL DEFAULT 1,
  status          TEXT        NOT NULL CHECK (status IN ('pending','delivered','failed','retrying')),
  http_status     INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_delivery_sub_idx     ON public.webhook_delivery_logs (subscription_id);
CREATE INDEX IF NOT EXISTS webhook_delivery_status_idx  ON public.webhook_delivery_logs (status);
CREATE INDEX IF NOT EXISTS webhook_delivery_created_idx ON public.webhook_delivery_logs (created_at DESC);

-- ============================================================
-- 11. IMPORT BATCHES
--    Track every file import operation
-- ============================================================
-- Sequence MUST be created before the table that uses it in DEFAULT
CREATE SEQUENCE IF NOT EXISTS import_batch_seq START 1000;

CREATE TABLE IF NOT EXISTS public.import_batches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  batch_ref       TEXT        NOT NULL UNIQUE DEFAULT 'IMP-' || LPAD(CAST(nextval('import_batch_seq') AS TEXT),8,'0'),
  import_type     TEXT        NOT NULL
                    CHECK (import_type IN ('resumes','candidates_csv','jobs_csv','legacy_zip','json_bulk')),
  source_label    TEXT        NOT NULL DEFAULT 'Direct Upload',
  file_name       TEXT,
  file_size_bytes BIGINT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','complete','partial','failed','rolled_back')),
  total_rows      INTEGER     DEFAULT 0,
  processed_rows  INTEGER     DEFAULT 0,
  success_rows    INTEGER     DEFAULT 0,
  error_rows      INTEGER     DEFAULT 0,
  skipped_rows    INTEGER     DEFAULT 0,
  config          JSONB       DEFAULT '{}'::jsonb,
  error_summary   TEXT,
  rollback_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_batches_user_idx    ON public.import_batches (user_id);
CREATE INDEX IF NOT EXISTS import_batches_status_idx  ON public.import_batches (status);
CREATE INDEX IF NOT EXISTS import_batches_created_idx ON public.import_batches (created_at DESC);

-- ============================================================
-- 12. IMPORT ROW ERRORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_row_errors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number      INTEGER     NOT NULL,
  raw_data        JSONB,
  error_type      TEXT,
  error_message   TEXT        NOT NULL,
  resolution      TEXT        CHECK (resolution IN ('skip','merge','create','manual_review',NULL)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_row_errors_batch_idx ON public.import_row_errors (batch_id);

-- ============================================================
-- 13. CANDIDATE SOURCE TRACKING
--    Where each candidate came from
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_source_tracking (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id       UUID        REFERENCES public.resumes(id) ON DELETE SET NULL,
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  source_type     TEXT        NOT NULL
                    CHECK (source_type IN (
                      'direct_upload','import_batch','job_portal','api',
                      'manual','referral','boolean_search','custom'
                    )),
  source_name     TEXT,   -- 'Naukri','Indeed','LinkedIn','Legacy DB'
  source_job_id   TEXT,   -- External portal's job ID
  source_cand_id  TEXT,   -- External portal's candidate ID
  portal_url      TEXT,
  import_batch_id UUID    REFERENCES public.import_batches(id) ON DELETE SET NULL,
  sync_status     TEXT    NOT NULL DEFAULT 'imported'
                    CHECK (sync_status IN ('imported','synced','error','pending','skipped')),
  sync_error      TEXT,
  consent_given   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_note    TEXT,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cand_source_resume_idx ON public.candidate_source_tracking (resume_id);
CREATE INDEX IF NOT EXISTS cand_source_user_idx   ON public.candidate_source_tracking (user_id);
CREATE INDEX IF NOT EXISTS cand_source_type_idx   ON public.candidate_source_tracking (source_type);

-- ============================================================
-- 14. GENERATED JDs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_jds (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  input_params    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  full_jd_text    TEXT        NOT NULL,
  structured_data JSONB       DEFAULT '{}'::jsonb,
  version         INTEGER     NOT NULL DEFAULT 1,
  is_final        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gen_jds_user_idx ON public.generated_jds (user_id);
CREATE INDEX IF NOT EXISTS gen_jds_job_idx  ON public.generated_jds (job_post_id);
CREATE INDEX IF NOT EXISTS gen_jds_created_idx ON public.generated_jds (created_at DESC);

DROP TRIGGER IF EXISTS gen_jds_updated_at ON public.generated_jds;
CREATE TRIGGER gen_jds_updated_at
  BEFORE UPDATE ON public.generated_jds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 15. GENERATED BOOLEAN SEARCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_boolean_searches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  generated_jd_id UUID        REFERENCES public.generated_jds(id) ON DELETE SET NULL,
  job_title       TEXT        NOT NULL,
  input_text      TEXT        NOT NULL,
  must_have       TEXT[]      DEFAULT '{}',
  nice_to_have    TEXT[]      DEFAULT '{}',
  exclude_keywords TEXT[]     DEFAULT '{}',
  short_boolean   TEXT,
  advanced_boolean TEXT,
  alternate_boolean TEXT,
  linkedin_search TEXT,
  naukri_search   TEXT,
  indeed_search   TEXT,
  structured_data JSONB       DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bool_search_user_idx    ON public.generated_boolean_searches (user_id);
CREATE INDEX IF NOT EXISTS bool_search_created_idx ON public.generated_boolean_searches (created_at DESC);

-- ============================================================
-- 16. JD ANALYSIS RESULTS
--    When user uploads a JD for analysis (keywords, questions, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jd_analysis_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  job_post_id     UUID        REFERENCES public.job_posts(id) ON DELETE SET NULL,
  source_jd_text  TEXT        NOT NULL,
  must_have_skills TEXT[]     DEFAULT '{}',
  nice_to_have_skills TEXT[]  DEFAULT '{}',
  alternate_titles TEXT[]     DEFAULT '{}',
  skill_clusters  JSONB       DEFAULT '{}'::jsonb,
  suggested_questions TEXT[]  DEFAULT '{}',
  screening_criteria JSONB    DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jd_analysis_user_idx    ON public.jd_analysis_results (user_id);
CREATE INDEX IF NOT EXISTS jd_analysis_created_idx ON public.jd_analysis_results (created_at DESC);

-- ============================================================
-- 17. API KEYS (for external integrations / headless access)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  key_prefix      TEXT        NOT NULL,                -- 'srp_' prefix
  key_hash        TEXT        NOT NULL UNIQUE,         -- SHA-256 of full key
  key_hint        TEXT        NOT NULL,                -- last 8 chars for display
  scopes          TEXT[]      NOT NULL DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx  ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx  ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON public.api_keys (is_active);

-- ============================================================
-- 18. FEATURE FLAGS (per-tenant feature control)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  feature         TEXT        NOT NULL,
  is_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  config          JSONB       DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_uq UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS feature_flags_user_idx ON public.feature_flags (user_id);

-- ============================================================
-- 19. SCREENING SESSIONS (track bulk vs single modes)
-- ============================================================
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS screening_mode TEXT DEFAULT 'single'
    CHECK (screening_mode IN ('single','bulk'));

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS full_ai_analysis JSONB DEFAULT NULL;

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'direct_upload'
    CHECK (source_type IN ('direct_upload','import_batch','job_portal','api','manual','boolean_search'));

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS source_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- ============================================================
-- 20. JOB POSTS: portal tracking extensions
-- ============================================================
ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS portal_syncs JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS boolean_search_id UUID
    REFERENCES public.generated_boolean_searches(id) ON DELETE SET NULL;

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS generated_jd_id UUID
    REFERENCES public.generated_jds(id) ON DELETE SET NULL;

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Migration v5 Enterprise complete ✓' AS result;
