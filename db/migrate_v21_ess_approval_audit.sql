-- v21: ESS approval metadata for leave requests

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
