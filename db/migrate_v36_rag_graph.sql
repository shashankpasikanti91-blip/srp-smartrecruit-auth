-- v36: Deep RAG (pgvector chunks) + light talent graph
-- pgvector is optional. Production images without the extension skip rag_chunks
-- so deploy can continue; RAG retrieve stays empty until vector is installed.

CREATE TABLE IF NOT EXISTS talent_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_type     TEXT NOT NULL,
  from_id       TEXT NOT NULL,
  edge_type     TEXT NOT NULL CHECK (edge_type IN ('has_skill', 'screened_for', 'applied_to')),
  to_type       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  weight        REAL NOT NULL DEFAULT 1.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, from_type, from_id, edge_type, to_type, to_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_edges_tenant_from
  ON talent_edges (tenant_id, from_type, from_id);

CREATE INDEX IF NOT EXISTS idx_talent_edges_tenant_to
  ON talent_edges (tenant_id, to_type, to_id, edge_type);

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available (%). Skipping rag_chunks — AI screening/posts still work.', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'Skipping rag_chunks (no pgvector extension).';
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      source_type   TEXT NOT NULL CHECK (source_type IN ('resume', 'job')),
      source_id     UUID NOT NULL,
      chunk_index   INT  NOT NULL DEFAULT 0,
      content       TEXT NOT NULL,
      embedding     vector(1536),
      token_est     INT  NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, source_type, source_id, chunk_index)
    )
  $ddl$;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_source ON rag_chunks (tenant_id, source_type, source_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw ON rag_chunks USING hnsw (embedding vector_cosine_ops)';
END $$;
