/**
 * app/api/interviews/[id]/route.ts
 * Update (reschedule, status change, feedback) or cancel an interview.
 *
 * PATCH  /api/interviews/[id]
 * DELETE /api/interviews/[id]
 */
import { NextRequest, NextResponse }  from 'next/server'
import { requireTenant }              from '@/lib/tenant'
import { pool }                       from '@/lib/db'
import { logAudit }                   from '@/lib/audit'
import { deleteCalendarEvent }        from '@/lib/calendar'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params

  // Fetch existing interview
  const { rows } = await pool.query(
    `SELECT id, short_id, tenant_id, interviewer_id, calendar_event_id, status
     FROM interviews WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const interview = rows[0]

  let body: {
    status?:          string
    scheduled_at?:    string
    duration_minutes?: number
    notes?:           string
    rating?:          number
    feedback?:        string
    location?:        string
    meet_link?:       string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: string[] = []
  const vals: unknown[]   = []
  let p = 1

  const VALID_STATUSES = ['scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show']

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` }, { status: 422 })
    }
    updates.push(`status = $${p++}`); vals.push(body.status)
  }
  if (body.scheduled_at) {
    const dt = new Date(body.scheduled_at)
    if (isNaN(dt.getTime())) return NextResponse.json({ error: 'Invalid scheduled_at' }, { status: 422 })
    updates.push(`scheduled_at = $${p++}`); vals.push(dt.toISOString())
  }
  if (body.duration_minutes) { updates.push(`duration_minutes = $${p++}`); vals.push(body.duration_minutes) }
  if (body.notes !== undefined)    { updates.push(`notes = $${p++}`);    vals.push(body.notes) }
  if (body.rating !== undefined)   { updates.push(`rating = $${p++}`);   vals.push(body.rating) }
  if (body.feedback !== undefined) { updates.push(`feedback = $${p++}`); vals.push(body.feedback) }
  if (body.location !== undefined) { updates.push(`location = $${p++}`); vals.push(body.location) }
  if (body.meet_link !== undefined){ updates.push(`meet_link = $${p++}`); vals.push(body.meet_link) }

  if (!updates.length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
  }

  updates.push(`updated_at = NOW()`)

  const { rows: updated } = await pool.query(
    `UPDATE interviews SET ${updates.join(', ')}
     WHERE id = $${p} AND tenant_id = $${p + 1}
     RETURNING id, short_id, status, scheduled_at, meet_link, rating, feedback`,
    [...vals, id, ctx.tenantId]
  )

  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'interview_updated',
    resourceType: 'interview',
    resourceId:   id,
    details:      { changes: body },
  })

  return NextResponse.json({ interview: updated[0] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params

  const { rows } = await pool.query(
    `SELECT id, tenant_id, interviewer_id, calendar_event_id
     FROM interviews WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const interview = rows[0]

  // Mark cancelled (soft delete)
  await pool.query(
    `UPDATE interviews SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [id]
  )

  // Delete calendar event if it exists
  if (interview.calendar_event_id) {
    // Detect provider by calendar_connections
    const { rows: calRows } = await pool.query(
      `SELECT provider FROM calendar_connections
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = TRUE LIMIT 1`,
      [ctx.tenantId, interview.interviewer_id]
    )
    if (calRows.length) {
      try {
        await deleteCalendarEvent(
          ctx.tenantId,
          interview.interviewer_id,
          calRows[0].provider,
          interview.calendar_event_id
        )
      } catch (e) {
        console.warn('[interviews] Calendar event deletion failed:', e)
      }
    }
  }

  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'interview_cancelled',
    resourceType: 'interview',
    resourceId:   id,
  })

  return NextResponse.json({ ok: true })
}
