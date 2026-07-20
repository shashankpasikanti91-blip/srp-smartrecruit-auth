-- v16: ESS lite (profile extensions, payslips, leave, company docs)

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.auth_users(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  emergency_contact TEXT,
  emergency_phone TEXT,
  address         TEXT,
  bank_name       TEXT,
  bank_account_masked TEXT,
  id_document_ref TEXT,
  profile_photo_path TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_payslips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  period_label    TEXT NOT NULL,
  period_month    DATE NOT NULL,
  storage_path    TEXT,
  external_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_payslips_user_idx ON public.employee_payslips (user_id, period_month DESC);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  leave_type      TEXT NOT NULL DEFAULT 'annual',
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days            NUMERIC(4,1) NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  balance_after   NUMERIC(6,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leave_requests_user_idx ON public.leave_requests (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL,
  title           TEXT NOT NULL,
  storage_path    TEXT,
  external_url    TEXT,
  visible_to_all  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_documents_tenant_idx ON public.company_documents (tenant_id);
