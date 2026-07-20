import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'

/** GET latest submission for a candidate (resume_id query param). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const resumeId = req.nextUrl.searchParams.get('resume_id')
  if (!resumeId || !isValidUUID(resumeId)) {
    return NextResponse.json({ error: 'resume_id required' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `SELECT * FROM submissions
     WHERE tenant_id = $1 AND resume_id = $2
     ORDER BY updated_at DESC LIMIT 1`,
    [ctx.tenantId, resumeId]
  )

  return NextResponse.json({ submission: rows[0] ?? null })
}
