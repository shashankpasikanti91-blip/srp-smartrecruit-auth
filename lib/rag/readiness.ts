/**
 * Production RAG readiness probe — call from health/ops scripts.
 * Soft-skip of pgvector is OK locally; production should surface not_ready.
 */
import { pool } from '@/lib/db'

export type RagReadiness = {
  pgvector: boolean
  rag_chunks: boolean
  status: 'ready' | 'not_ready' | 'degraded'
  detail: string
}

export async function checkRagReadiness(): Promise<RagReadiness> {
  let pgvector = false
  let rag_chunks = false
  try {
    const ext = await pool.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    )
    pgvector = ext.rows.length > 0
  } catch {
    pgvector = false
  }
  try {
    const t = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rag_chunks'`
    )
    rag_chunks = t.rows.length > 0
  } catch {
    rag_chunks = false
  }

  if (pgvector && rag_chunks) {
    return { pgvector, rag_chunks, status: 'ready', detail: 'pgvector + rag_chunks available' }
  }
  if (!pgvector) {
    return {
      pgvector,
      rag_chunks,
      status: 'not_ready',
      detail: 'pgvector extension missing — install before claiming RAG in production',
    }
  }
  return {
    pgvector,
    rag_chunks,
    status: 'degraded',
    detail: 'pgvector present but rag_chunks table missing — apply migrate_v36+',
  }
}

/** Fail closed when ENVIRONMENT=production and RAG is advertised as a required capability. */
export function assertRagReadyForProduction(r: RagReadiness, env = process.env.ENVIRONMENT): void {
  if (env !== 'production') return
  if (process.env.RAG_REQUIRED === '0') return
  if (r.status !== 'ready') {
    throw new Error(`[rag] production not ready: ${r.detail}`)
  }
}
