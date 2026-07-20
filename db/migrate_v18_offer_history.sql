-- v18: Offer history

CREATE TABLE IF NOT EXISTS public.offer_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_case_id   UUID NOT NULL REFERENCES public.offer_cases(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  old_status      TEXT,
  new_status      TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_history_case_idx ON public.offer_history (offer_case_id, created_at DESC);
