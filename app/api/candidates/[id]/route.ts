import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const allowed = ['pipeline_stage', 'status', 'reviewer_notes', 'ai_score', 'ai_summary', 'job_post_id']
    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1
    for (const key of allowed) {
      if (body[key] !== undefined) { sets.push(`${key} = $${idx}`); values.push(body[key]); idx++ }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    values.push(id)
    const { rows } = await pool.query(
      `UPDATE resumes SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, short_id, pipeline_stage, status, match_category`,
      values
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Fire-and-forget audit log
    const userRes2 = await pool.query<{id:string}>('SELECT id FROM auth_users WHERE email=$1',[session.user.email])
    if (userRes2.rows[0] && body.pipeline_stage) {
      logAudit({ userId: userRes2.rows[0].id, userEmail: session.user.email, action: 'stage_changed',
        resourceType: 'candidate', resourceId: rows[0].short_id ?? id,
        details: { stage: body.pipeline_stage } })
    }
    return NextResponse.json({ candidate: rows[0] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

