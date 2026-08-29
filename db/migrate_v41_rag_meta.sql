-- v41: RAG production readiness helpers (additive metadata only)
-- Documents that production RAG requires pgvector. Soft-skip remains for local/dev
-- without the extension; ENVIRONMENT=production should fail health when rag required.

ALTER TABLE IF EXISTS rag_chunks
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON TABLE rag_chunks IS 'Tenant-scoped RAG chunks. Requires pgvector. Authz: filter tenant_id BEFORE retrieve.';
