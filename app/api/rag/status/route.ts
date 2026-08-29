import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, requireGovernanceAccess } from '@/lib/tenant'
import { pool } from '@/lib/db'
/**
 * GET /api/rag/status
 * Admin/owner — corpus health for Deep RAG (tenant-scoped).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  const denied = requireGovernanceAccess(ctx)
  if (denied) return denied
  try {
    const { checkRagReadiness } = await import('@/lib/rag/readiness')
    const readiness = await checkRagReadiness()

    if (readiness.status !== 'ready') {
      return NextResponse.json({
        ok: true,
        vector_ready: false,
        readiness,
        resume_chunks: 0,
        job_chunks: 0,
        resume_sources: 0,
        job_sources: 0,
        last_indexed_at: null,
      })
    }

    const { rows } = await pool.query<{
      resume_chunks: string
      job_chunks: string
      resume_sources: string
      job_sources: string
      last_indexed_at: string | null
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE source_type = 'resume')::text AS resume_chunks,
         COUNT(*) FILTER (WHERE source_type = 'job')::text AS job_chunks,
         COUNT(DISTINCT source_id) FILTER (WHERE source_type = 'resume')::text AS resume_sources,
         COUNT(DISTINCT source_id) FILTER (WHERE source_type = 'job')::text AS job_sources,
         MAX(updated_at)::text AS last_indexed_at
       FROM rag_chunks
       WHERE tenant_id = $1`,
      [ctx.tenantId],
    )

    const r = rows[0]
    return NextResponse.json({
      ok: true,
      vector_ready: true,
      readiness,
      resume_chunks: Number(r?.resume_chunks ?? 0),
      job_chunks: Number(r?.job_chunks ?? 0),
      resume_sources: Number(r?.resume_sources ?? 0),
      job_sources: Number(r?.job_sources ?? 0),
      last_indexed_at: r?.last_indexed_at ?? null,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      vector_ready: false,
      resume_chunks: 0,
      job_chunks: 0,
      resume_sources: 0,
      job_sources: 0,
      last_indexed_at: null,
      error: e instanceof Error ? e.message : 'status unavailable',
    })
  }
}
