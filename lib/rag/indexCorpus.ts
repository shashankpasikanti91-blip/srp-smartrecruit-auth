/**
 * Index resume or job text into rag_chunks + skill edges.
 */
import { pool } from '@/lib/db'
import { chunkText } from '@/lib/rag/chunkText'
import { embedChunks, toPgVectorLiteral } from '@/lib/rag/embed'
import { upsertResumeSkillEdges } from '@/lib/rag/graph'
import { buildJdFromJobRow } from '@/lib/jobScreeningContext'

export type RagSourceType = 'resume' | 'job'

export type IndexResult = {
  source_type: RagSourceType
  source_id: string
  chunks: number
  skills_linked?: number
  skipped?: boolean
  reason?: string
}

async function tableReady(): Promise<boolean> {
  try {
    await pool.query(`SELECT 1 FROM rag_chunks LIMIT 0`)
    return true
  } catch {
    return false
  }
}

export async function indexResumeCorpus(opts: {
  tenantId: string
  resumeId: string
  rawText?: string | null
  skills?: string[] | null
  userId?: string | null
}): Promise<IndexResult> {
  if (!(await tableReady())) {
    return { source_type: 'resume', source_id: opts.resumeId, chunks: 0, skipped: true, reason: 'rag_chunks missing' }
  }

  let text = (opts.rawText ?? '').trim()
  let skills = opts.skills ?? []
  if (!text || !skills.length) {
    const { rows } = await pool.query(
      `SELECT raw_text, ai_skills FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [opts.resumeId, opts.tenantId],
    )
    const row = rows[0]
    if (!row) {
      return { source_type: 'resume', source_id: opts.resumeId, chunks: 0, skipped: true, reason: 'not found' }
    }
    if (!text) text = String(row.raw_text ?? '').trim()
    if (!skills.length && Array.isArray(row.ai_skills)) skills = row.ai_skills as string[]
  }

  if (text.length < 40) {
    return { source_type: 'resume', source_id: opts.resumeId, chunks: 0, skipped: true, reason: 'text too short' }
  }

  const chunks = chunkText(text).slice(0, 40)
  const vectors = await embedChunks({
    texts: chunks.map(c => c.content),
    userId: opts.userId,
    tenantId: opts.tenantId,
    operation: 'rag_index_resume',
  })

  await pool.query(
    `DELETE FROM rag_chunks WHERE tenant_id = $1 AND source_type = 'resume' AND source_id = $2`,
    [opts.tenantId, opts.resumeId],
  )

  for (let i = 0; i < chunks.length; i++) {
    const lit = toPgVectorLiteral(vectors[i] ?? [])
    await pool.query(
      `INSERT INTO rag_chunks
         (tenant_id, source_type, source_id, chunk_index, content, embedding, token_est)
       VALUES ($1,'resume',$2,$3,$4,$5::vector,$6)`,
      [opts.tenantId, opts.resumeId, chunks[i].index, chunks[i].content, lit, chunks[i].tokenEst],
    )
  }

  let skillsLinked = 0
  try {
    skillsLinked = await upsertResumeSkillEdges(opts.tenantId, opts.resumeId, skills)
  } catch (e) {
    console.warn('[rag/index] skill edges skipped:', e instanceof Error ? e.message : e)
  }

  return { source_type: 'resume', source_id: opts.resumeId, chunks: chunks.length, skills_linked: skillsLinked }
}

export async function indexJobCorpus(opts: {
  tenantId: string
  jobId: string
  jdText?: string | null
  userId?: string | null
}): Promise<IndexResult> {
  if (!(await tableReady())) {
    return { source_type: 'job', source_id: opts.jobId, chunks: 0, skipped: true, reason: 'rag_chunks missing' }
  }

  let text = (opts.jdText ?? '').trim()
  if (!text) {
    const { rows } = await pool.query(
      `SELECT title, location, skills_mandatory, skills_required, tags,
              experience_min, experience_max, raw_jd_text, description, requirements
       FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [opts.jobId, opts.tenantId],
    )
    const row = rows[0]
    if (!row) {
      return { source_type: 'job', source_id: opts.jobId, chunks: 0, skipped: true, reason: 'not found' }
    }
    text = buildJdFromJobRow(row as Parameters<typeof buildJdFromJobRow>[0]).trim()
  }

  if (text.length < 40) {
    return { source_type: 'job', source_id: opts.jobId, chunks: 0, skipped: true, reason: 'text too short' }
  }

  const chunks = chunkText(text).slice(0, 30)
  const vectors = await embedChunks({
    texts: chunks.map(c => c.content),
    userId: opts.userId,
    tenantId: opts.tenantId,
    operation: 'rag_index_job',
  })

  await pool.query(
    `DELETE FROM rag_chunks WHERE tenant_id = $1 AND source_type = 'job' AND source_id = $2`,
    [opts.tenantId, opts.jobId],
  )

  for (let i = 0; i < chunks.length; i++) {
    const lit = toPgVectorLiteral(vectors[i] ?? [])
    await pool.query(
      `INSERT INTO rag_chunks
         (tenant_id, source_type, source_id, chunk_index, content, embedding, token_est)
       VALUES ($1,'job',$2,$3,$4,$5::vector,$6)`,
      [opts.tenantId, opts.jobId, chunks[i].index, chunks[i].content, lit, chunks[i].tokenEst],
    )
  }

  return { source_type: 'job', source_id: opts.jobId, chunks: chunks.length }
}

/** Fire-and-forget index; never throws to callers. */
export function scheduleIndexResume(opts: {
  tenantId: string
  resumeId: string
  rawText?: string | null
  skills?: string[] | null
  userId?: string | null
}): void {
  void indexResumeCorpus(opts).catch(err => {
    console.warn('[rag] index resume failed:', err instanceof Error ? err.message : err)
  })
}

export function scheduleIndexJob(opts: {
  tenantId: string
  jobId: string
  jdText?: string | null
  userId?: string | null
}): void {
  void indexJobCorpus(opts).catch(err => {
    console.warn('[rag] index job failed:', err instanceof Error ? err.message : err)
  })
}
