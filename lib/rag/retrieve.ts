/**
 * Tenant-scoped vector retrieval over rag_chunks.
 */
import { pool } from '@/lib/db'
import { wrapUntrustedData } from '@/lib/aiSecurity'
import { embedChunks, toPgVectorLiteral } from '@/lib/rag/embed'
import type { RagSourceType } from '@/lib/rag/indexCorpus'

export type RetrievedChunk = {
  id: string
  source_type: RagSourceType
  source_id: string
  chunk_index: number
  content: string
  score: number
}

export async function retrieveChunks(opts: {
  tenantId: string
  query: string
  topK?: number
  sourceType?: RagSourceType | null
  sourceIds?: string[] | null
  userId?: string | null
  /** Drop resume/job chunks the caller is not allowed to read. Default: both allowed. */
  allowResumes?: boolean
  allowJobs?: boolean
}): Promise<RetrievedChunk[]> {
  const q = opts.query.trim()
  if (!q) return []
  const topK = Math.min(20, Math.max(1, opts.topK ?? 6))

  let vectors: number[][]
  try {
    vectors = await embedChunks({
      texts: [q],
      userId: opts.userId,
      tenantId: opts.tenantId,
      operation: 'rag_retrieve',
    })
  } catch (e) {
    console.warn('[rag/retrieve] embed failed:', e instanceof Error ? e.message : e)
    return []
  }
  const lit = toPgVectorLiteral(vectors[0] ?? [])

  const params: unknown[] = [opts.tenantId, lit, topK]
  let filter = ''
  if (opts.sourceType) {
    params.push(opts.sourceType)
    filter += ` AND source_type = $${params.length}`
  }
  if (opts.sourceIds?.length) {
    params.push(opts.sourceIds)
    filter += ` AND source_id = ANY($${params.length}::uuid[])`
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, source_type, source_id, chunk_index, content,
              1 - (embedding <=> $2::vector) AS score
       FROM rag_chunks
       WHERE tenant_id = $1 AND embedding IS NOT NULL ${filter}
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      params,
    )
    const mapped = rows.map(r => ({
      id: String(r.id),
      source_type: r.source_type as RagSourceType,
      source_id: String(r.source_id),
      chunk_index: Number(r.chunk_index ?? 0),
      content: String(r.content ?? ''),
      score: Math.max(0, Math.min(1, Number(r.score ?? 0))),
    }))
    return authorizeRetrievedChunks({
      tenantId: opts.tenantId,
      chunks: mapped,
      allowResumes: opts.allowResumes !== false,
      allowJobs: opts.allowJobs !== false,
    })
  } catch (e) {
    console.warn('[rag/retrieve] query failed:', e instanceof Error ? e.message : e)
    return []
  }
}

/** ACL before LLM context: permission flags + source still belongs to this tenant. */
export async function authorizeRetrievedChunks(opts: {
  tenantId: string
  chunks: RetrievedChunk[]
  allowResumes: boolean
  allowJobs: boolean
}): Promise<RetrievedChunk[]> {
  const filtered = opts.chunks.filter(c => {
    if (c.source_type === 'resume' && !opts.allowResumes) return false
    if (c.source_type === 'job' && !opts.allowJobs) return false
    return true
  })
  if (!filtered.length) return []

  const resumeIds = [...new Set(filtered.filter(c => c.source_type === 'resume').map(c => c.source_id))]
  const jobIds = [...new Set(filtered.filter(c => c.source_type === 'job').map(c => c.source_id))]
  const allowed = new Set<string>()

  if (resumeIds.length) {
    try {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM resumes WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [opts.tenantId, resumeIds],
      )
      for (const r of rows) allowed.add(`resume:${r.id}`)
    } catch { /* table may vary */ }
  }
  if (jobIds.length) {
    try {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM job_posts WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [opts.tenantId, jobIds],
      )
      for (const r of rows) allowed.add(`job:${r.id}`)
    } catch { /* table may vary */ }
  }

  return filtered.filter(c => allowed.has(`${c.source_type}:${c.source_id}`))
}

/** Best cosine similarity per source_id (0–1) for a set of candidate resumes. */
export async function resumeVectorScores(opts: {
  tenantId: string
  query: string
  resumeIds: string[]
  userId?: string | null
}): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!opts.resumeIds.length || !opts.query.trim()) return map

  const hits = await retrieveChunks({
    tenantId: opts.tenantId,
    query: opts.query,
    topK: Math.min(40, Math.max(opts.resumeIds.length, 10)),
    sourceType: 'resume',
    sourceIds: opts.resumeIds,
    userId: opts.userId,
  })

  for (const h of hits) {
    const prev = map.get(h.source_id) ?? 0
    if (h.score > prev) map.set(h.source_id, h.score)
  }
  return map
}

export function formatChunksForPrompt(chunks: RetrievedChunk[], title = 'VECTOR RAG PASSAGES'): string {
  if (!chunks.length) return ''
  const lines = chunks.map((c, i) => {
    const cite = `[${c.source_type}:${c.source_id.slice(0, 8)}#${c.chunk_index}]`
    return `${i + 1}. ${cite} (sim=${c.score.toFixed(3)})\n${c.content.slice(0, 600)}`
  })
  return wrapUntrustedData(title, `${title} (cite source tags when using):\n${lines.join('\n\n')}`)
}
