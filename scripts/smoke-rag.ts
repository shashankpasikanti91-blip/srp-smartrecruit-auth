/**
 * Live RAG smoke against configured DATABASE_URL.
 * Run: npx tsx scripts/smoke-rag.ts
 *
 * Optional env:
 *   SMOKE_TENANT_ID — UUID to scope chunk counts + optional retrieval probe
 *   SMOKE_RAG_QUERY  — query string (default: "Java engineer")
 */
import 'dotenv/config'
import { pool } from '../lib/db'
import { checkRagReadiness } from '../lib/rag/readiness'

async function main() {
  const readiness = await checkRagReadiness()
  const tenantId = process.env.SMOKE_TENANT_ID?.trim()
  const query = (process.env.SMOKE_RAG_QUERY ?? 'Java engineer').trim()

  let tenantChunks = 0
  let retrievalCount = 0

  if (readiness.status === 'ready' && tenantId) {
    const counts = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM rag_chunks WHERE tenant_id = $1`,
      [tenantId],
    )
    tenantChunks = parseInt(counts.rows[0]?.c ?? '0', 10)

    try {
      const { retrieveChunks } = await import('../lib/rag/retrieve')
      const hits = await retrieveChunks({
        tenantId,
        query,
        topK: 5,
        allowResumes: true,
        allowJobs: true,
      })
      retrievalCount = hits.length
    } catch (e) {
      console.error(JSON.stringify({
        ok: false,
        readiness,
        tenant_id: tenantId,
        tenant_chunks: tenantChunks,
        error: e instanceof Error ? e.message : 'retrieval failed',
      }, null, 2))
      process.exit(1)
    }
  }

  const ok = readiness.status === 'ready'
  console.log(JSON.stringify({
    ok,
    readiness,
    tenant_id: tenantId ?? null,
    tenant_chunks: tenantId ? tenantChunks : null,
    retrieval_hits: tenantId ? retrievalCount : null,
    query: tenantId ? query : null,
    note: tenantId
      ? 'Live retrieval probe completed'
      : 'Set SMOKE_TENANT_ID for tenant-scoped retrieval probe',
  }, null, 2))

  await pool.end().catch(() => {})
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
