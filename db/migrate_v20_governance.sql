-- v20: User sessions, login history, activity & data access logs

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  session_token   TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  device_type     TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON public.user_sessions (tenant_id, is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.login_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  email           TEXT,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address      TEXT,
  user_agent      TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_history_user_idx ON public.login_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  page_path       TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_activity_tenant_idx ON public.user_activity_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  access_type     TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  user_role       TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS data_access_tenant_idx ON public.data_access_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_access_user_idx ON public.data_access_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  suggestions     TEXT NOT NULL,
  kpi_snapshot    JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_suggestions_user_idx ON public.coach_suggestions (user_id, created_at DESC);
