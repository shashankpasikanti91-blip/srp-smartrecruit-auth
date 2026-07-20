import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { buildCandidateTimeline } from '@/lib/candidateTimeline'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { rows } = await pool.query<{ short_id: string; candidate_email: string | null }>(
    'SELECT short_id, candidate_email FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  const cand = rows[0]
  if (!cand) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
  const cursor = req.nextUrl.searchParams.get('cursor')

  const result = await buildCandidateTimeline({
    tenantId: ctx.tenantId,
    resumeId: id,
    shortId: cand.short_id,
    candidateEmail: cand.candidate_email,
    limit,
    cursor,
  })

  return NextResponse.json(result)
}
