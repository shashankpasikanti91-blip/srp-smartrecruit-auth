-- v14: Candidate document slots + version history; timeline comm link

CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resume_id       UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  slot_type       TEXT NOT NULL CHECK (slot_type IN (
    'resume', 'passport', 'visa', 'certificate', 'offer_letter', 'experience_letter', 'other'
  )),
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resume_id, slot_type)
);

CREATE INDEX IF NOT EXISTS candidate_documents_tenant_resume_idx
  ON public.candidate_documents (tenant_id, resume_id);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_no      INTEGER NOT NULL DEFAULT 1,
  storage_path    TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  mime_type       TEXT,
  file_size_bytes INTEGER,
  uploaded_by     UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_no)
);

CREATE INDEX IF NOT EXISTS document_versions_doc_idx
  ON public.document_versions (document_id, version_no DESC);

-- Link comm logs to candidates for timeline
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comm_logs_tenant_resume_idx
  ON public.communication_logs (tenant_id, resume_id)
  WHERE resume_id IS NOT NULL;

-- Backfill resume slot from resume_original_path (idempotent)
INSERT INTO public.candidate_documents (tenant_id, resume_id, slot_type, label)
SELECT r.tenant_id, r.id, 'resume', COALESCE(r.file_name, 'Resume')
FROM public.resumes r
WHERE r.resume_original_path IS NOT NULL AND r.resume_original_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.candidate_documents cd
    WHERE cd.resume_id = r.id AND cd.slot_type = 'resume'
  );

INSERT INTO public.document_versions (
  document_id, tenant_id, version_no, storage_path, file_name, mime_type, file_size_bytes, uploaded_by
)
SELECT cd.id, cd.tenant_id, 1, r.resume_original_path,
       COALESCE(r.file_name, 'resume.pdf'),
       CASE
         WHEN r.resume_original_path ILIKE '%.pdf' THEN 'application/pdf'
         WHEN r.resume_original_path ILIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         WHEN r.resume_original_path ILIKE '%.doc' THEN 'application/msword'
         ELSE 'text/plain'
       END,
       r.file_size_bytes,
       r.user_id
FROM public.resumes r
JOIN public.candidate_documents cd ON cd.resume_id = r.id AND cd.slot_type = 'resume'
WHERE r.resume_original_path IS NOT NULL AND r.resume_original_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.document_versions dv WHERE dv.document_id = cd.id
  );
