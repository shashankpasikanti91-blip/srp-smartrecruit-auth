import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { indexJobCorpus, indexResumeCorpus } from '@/lib/rag/indexCorpus'
import { getAIConfig } from '@/lib/aiClient'

/**
 * POST /api/rag/reindex
 * Tenant admin/owner — backfill rag_chunks for resumes and/or jobs.
 * Body: { dry_run?: boolean, limit?: number, source?: 'resume'|'job'|'all' }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  if (ctx.tenantRole !== 'admin' && ctx.tenantRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — admin or owner only' }, { status: 403 })
  }

  if (!getAIConfig()) {
    return NextResponse.json({ error: 'AI not configured — set OPENAI_API_KEY' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({})) as {
    dry_run?: boolean
    limit?: number
    source?: 'resume' | 'job' | 'all'
  }
  const dryRun = Boolean(body.dry_run)
  const limit = Math.min(200, Math.max(1, Number(body.limit) || 25))
  const source = body.source === 'resume' || body.source === 'job' ? body.source : 'all'

  const results: Array<Record<string, unknown>> = []
  let indexed = 0
  let skipped = 0

  if (source === 'resume' || source === 'all') {
    const { rows } = await pool.query(
      `SELECT id, short_id, LENGTH(COALESCE(raw_text,'')) AS len
       FROM resumes
       WHERE tenant_id = $1 AND COALESCE(raw_text,'') <> ''
       ORDER BY updated_at DESC NULLS LAST
       LIMIT $2`,
      [ctx.tenantId, limit],
    )
    for (const row of rows) {
      if (dryRun) {
        results.push({ source: 'resume', id: row.id, short_id: row.short_id, chars: row.len, would_index: true })
        continue
      }
      try {
        const r = await indexResumeCorpus({
          tenantId: ctx.tenantId,
          resumeId: String(row.id),
          userId: ctx.userId,
        })
        if (r.skipped) skipped++
        else indexed++
        results.push(r)
      } catch (e) {
        skipped++
        results.push({
          source_type: 'resume',
          source_id: row.id,
          error: e instanceof Error ? e.message : 'index failed',
        })
      }
    }
  }

  if (source === 'job' || source === 'all') {
    const jobLimit = source === 'all' ? Math.max(5, Math.floor(limit / 2)) : limit
    const { rows } = await pool.query(
      `SELECT id, short_id, title
       FROM job_posts
       WHERE tenant_id = $1 AND status != 'archived'
       ORDER BY updated_at DESC NULLS LAST
       LIMIT $2`,
      [ctx.tenantId, jobLimit],
    )
    for (const row of rows) {
      if (dryRun) {
        results.push({ source: 'job', id: row.id, short_id: row.short_id, title: row.title, would_index: true })
        continue
      }
      try {
        const r = await indexJobCorpus({
          tenantId: ctx.tenantId,
          jobId: String(row.id),
          userId: ctx.userId,
        })
        if (r.skipped) skipped++
        else indexed++
        results.push(r)
      } catch (e) {
        skipped++
        results.push({
          source_type: 'job',
          source_id: row.id,
          error: e instanceof Error ? e.message : 'index failed',
        })
      }
    }
  }

  return NextResponse.json({
    dry_run: dryRun,
    indexed: dryRun ? 0 : indexed,
    skipped: dryRun ? 0 : skipped,
    sample: results.slice(0, 40),
    total_results: results.length,
  })
}
