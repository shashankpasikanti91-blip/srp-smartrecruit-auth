import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const cand = await pool.query(
    'SELECT id, job_post_id FROM resumes WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
  if (!cand.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const jobs: Record<string, unknown>[] = []
  const seen = new Set<string>()

  if (cand.rows[0].job_post_id) {
    const { rows } = await pool.query(
      `SELECT id, short_id, title, company, location, status FROM job_posts WHERE id = $1 AND tenant_id = $2`,
      [cand.rows[0].job_post_id, ctx.tenantId]
    )
    for (const j of rows) {
      seen.add(j.id)
      jobs.push({ ...j, source: 'assigned' })
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT jp.id, jp.short_id, jp.title, jp.company, jp.location, jp.status, s.stage
       FROM submissions s
       JOIN job_posts jp ON jp.id = s.job_post_id
       WHERE s.tenant_id = $1 AND s.resume_id = $2 AND s.job_post_id IS NOT NULL`,
      [ctx.tenantId, id]
    )
    for (const j of rows) {
      if (seen.has(j.id)) continue
      seen.add(j.id)
      jobs.push({ ...j, source: 'submission' })
    }
  } catch { /* ignore */ }

  return NextResponse.json({ jobs })
}
