-- v37: Audit correlation / actor type + tenant on AI cache tables
-- Additive only — no drops / renames

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_type TEXT;

CREATE INDEX IF NOT EXISTS audit_logs_correlation_idx
  ON public.audit_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.generated_boolean_searches
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS bool_search_tenant_idx
  ON public.generated_boolean_searches (tenant_id, created_at DESC);

ALTER TABLE public.generated_jds
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS gen_jds_tenant_idx
  ON public.generated_jds (tenant_id, created_at DESC);
