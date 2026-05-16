import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { isValidUUID, sanitizeText, sanitizeEnum } from '@/lib/validate'

const VALID_STATUSES = ['active', 'closed', 'draft', 'archived'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'jobs.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // Verify job belongs to this tenant
  const { rows: existing } = await pool.query(
    'SELECT id, title FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  if (!existing[0]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const body = await req.json()
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (body.status !== undefined) {
    const st = sanitizeEnum(body.status, VALID_STATUSES, null)
    if (!st) return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    sets.push(`status = $${idx++}`); vals.push(st)
  }
  if (body.title !== undefined) {
    const t = sanitizeText(body.title, 200)
    if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    sets.push(`title = $${idx++}`); vals.push(t)
  }
  if (body.description !== undefined) {
    sets.push(`description = $${idx++}`); vals.push(sanitizeText(body.description, 20000))
  }
  if (body.requirements !== undefined) {
    sets.push(`requirements = $${idx++}`); vals.push(sanitizeText(body.requirements, 8000))
  }
  if (body.location !== undefined) {
    sets.push(`location = $${idx++}`); vals.push(sanitizeText(body.location, 200))
  }
  if (body.company !== undefined) {
    sets.push(`company = $${idx++}`); vals.push(sanitizeText(body.company, 200))
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  sets.push(`updated_at = NOW()`)
  vals.push(id, ctx.tenantId)

  const { rows } = await pool.query(
    `UPDATE job_posts SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
    vals
  )

  logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail,
    action: 'job_updated', resourceType: 'job', resourceId: id,
    details: body, tenantId: ctx.tenantId,
  })

  return NextResponse.json({ job: rows[0] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'jobs.delete')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // Soft-delete: set status to archived (tenant-scoped)
  const { rows } = await pool.query(
    `UPDATE job_posts SET status = 'archived', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [id, ctx.tenantId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail,
    action: 'job_archived', resourceType: 'job', resourceId: id,
    details: {}, tenantId: ctx.tenantId,
  })

  return NextResponse.json({ ok: true })
}
