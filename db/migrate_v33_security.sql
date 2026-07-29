-- v33: Enterprise Security Center additive tables
-- Additive only — no drops / renames

CREATE TABLE IF NOT EXISTS public.tenant_security_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  min_length            INT NOT NULL DEFAULT 8,
  require_uppercase     BOOLEAN NOT NULL DEFAULT TRUE,
  require_lowercase     BOOLEAN NOT NULL DEFAULT TRUE,
  require_number        BOOLEAN NOT NULL DEFAULT TRUE,
  require_special       BOOLEAN NOT NULL DEFAULT FALSE,
  password_expiry_days  INT,
  password_history_count INT NOT NULL DEFAULT 3,
  max_login_attempts    INT NOT NULL DEFAULT 5,
  lock_duration_minutes INT NOT NULL DEFAULT 30,
  mfa_required          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.password_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_history_user_idx ON public.password_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  duration_hours  INT NOT NULL DEFAULT 4,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','expired','revoked')),
  decided_by      UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_requests_tenant_idx ON public.support_requests (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id     UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  actions_log       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_sessions_active_idx
  ON public.support_sessions (tenant_id, is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.mfa_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  method          TEXT NOT NULL CHECK (method IN ('totp','email')),
  label           TEXT,
  secret_enc      TEXT,
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mfa_devices_user_idx ON public.mfa_devices (user_id);

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  code_hash       TEXT NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mfa_recovery_user_idx ON public.mfa_recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS public.tenant_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  export_type     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'completed',
  row_count       INT,
  meta            JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tenant_exports_tenant_idx ON public.tenant_exports (tenant_id, created_at DESC);

-- Soft lock fields on auth_users (additive)
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Enrich login_history for role / session token (additive)
ALTER TABLE public.login_history
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS session_token TEXT,
  ADD COLUMN IF NOT EXISTS logout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT;
