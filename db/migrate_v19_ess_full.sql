-- v19: Full ESS — attendance, employee documents, announcements

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL,
  check_in_at     TIMESTAMPTZ,
  check_out_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'present' CHECK (status IN (
    'present', 'absent', 'half_day', 'leave', 'holiday', 'remote'
  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, work_date)
);

CREATE INDEX IF NOT EXISTS attendance_user_date_idx ON public.attendance_records (user_id, work_date DESC);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL,
  title           TEXT NOT NULL,
  storage_path    TEXT,
  external_url    TEXT,
  uploaded_by     UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_documents_user_idx ON public.employee_documents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS company_announcements_tenant_idx ON public.company_announcements (tenant_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.hr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN ('hr', 'it', 'document', 'other')),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'resolved', 'rejected', 'cancelled'
  )),
  resolved_by     UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_requests_tenant_idx ON public.hr_requests (tenant_id, created_at DESC);
