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
import { writeTimeline }              from '@/lib/timelineEngine'
import { createNotification }         from '@/lib/notificationCenter'
import { upsertWorkflowInstance }     from '@/lib/workflowEngine'
import { runCollaborativeChain }      from '@/lib/agentCollaboration'
import { advanceFromDomain, interviewStatusToLifecycle } from '@/lib/lifecycle'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'pipeline.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params

  // Fetch existing interview
  const { rows } = await pool.query(
    `SELECT id, short_id, tenant_id, interviewer_id, calendar_event_id, status,
            resume_id, job_post_id, candidate_name
     FROM interviews WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const interview = rows[0]
  const oldStatus = interview.status as string

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

  const VALID_STATUSES = [
    'scheduled', 'confirmed', 'rescheduled', 'postponed', 'completed',
    'cancelled', 'no_show', 'selected', 'awaiting_feedback', 'rejected',
  ]

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

  const newStatus = updated[0]?.status as string
  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'interview_updated',
    resourceType: 'interview',
    resourceId:   id,
    resumeId:     interview.resume_id,
    details:      { changes: body, old_status: oldStatus, new_status: newStatus },
  })

  if (body.status !== undefined && newStatus !== oldStatus) {
    const statusTitles: Record<string, string> = {
      scheduled: 'Interview Scheduled',
      confirmed: 'Interview Confirmed',
      rescheduled: 'Interview Rescheduled',
      completed: 'Interview Completed',
      cancelled: 'Interview Cancelled',
      no_show: 'Interview No-Show',
    }
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'interview',
      entityId: id,
      resumeId: interview.resume_id,
      eventType: `interview_${newStatus}`,
      title: statusTitles[newStatus] ?? `Interview ${newStatus}`,
      detail: `${oldStatus} → ${newStatus}${interview.candidate_name ? ` · ${interview.candidate_name}` : ''}`,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
    })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: 'interview',
      title: statusTitles[newStatus] ?? `Interview updated`,
      body: `${oldStatus} → ${newStatus}`,
      resumeId: interview.resume_id,
      entityType: 'interview',
      entityId: id,
    })
    await upsertWorkflowInstance({
      tenantId: ctx.tenantId,
      entityType: 'interview',
      entityId: id,
      stage: newStatus,
      resumeId: interview.resume_id,
      jobPostId: interview.job_post_id,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      detail: `${oldStatus} → ${newStatus}`,
    })
    if (newStatus === 'completed') {
      await runCollaborativeChain({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        triggerEvent: 'interview_completed',
        resumeId: interview.resume_id,
        jobPostId: interview.job_post_id,
        entityType: 'interview',
        entityId: id,
        candidateName: interview.candidate_name,
      })
    }
    await advanceFromDomain({
      tenantId: ctx.tenantId,
      resumeId: interview.resume_id,
      toStage: interviewStatusToLifecycle(newStatus),
      jobPostId: interview.job_post_id,
      relatedEntityType: 'interview',
      relatedEntityId: id,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      reason: `interview_status:${oldStatus}->${newStatus}`,
    })
  }

  return NextResponse.json({ interview: updated[0] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'pipeline.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params

  const { rows } = await pool.query(
    `SELECT id, tenant_id, interviewer_id, calendar_event_id, resume_id, short_id, candidate_name
     FROM interviews WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const interview = rows[0]

  // Mark cancelled (soft delete) — always include tenant_id
  await pool.query(
    `UPDATE interviews SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )

  if (interview.calendar_event_id) {
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

  await writeTimeline({
    tenantId: ctx.tenantId,
    entityType: 'interview',
    entityId: id,
    resumeId: interview.resume_id,
    eventType: 'interview_cancelled',
    title: 'Interview Cancelled',
    detail: interview.candidate_name ?? interview.short_id,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
  })

  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'interview_cancelled',
    resourceType: 'interview',
    resourceId:   id,
    resumeId:     interview.resume_id,
  })

  await createNotification({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    category: 'interview',
    title: `Interview cancelled${interview.candidate_name ? ` — ${interview.candidate_name}` : ''}`,
    resumeId: interview.resume_id,
    entityType: 'interview',
    entityId: id,
  })

  return NextResponse.json({ ok: true })
}
