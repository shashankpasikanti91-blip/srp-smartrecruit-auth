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
import { advanceFromDomain, interviewStatusToLifecycle, hasOtherOpenSubmissions } from '@/lib/lifecycle'
import { ensureOfferForSelection, closeShareForJob } from '@/lib/lifecycleCascade'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    scheduled_at?:    string | null
    duration_minutes?: number
    notes?:           string
    rating?:          number
    feedback?:        string
    location?:        string
    meet_link?:       string
    round?:           number
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: string[] = []
  const vals: unknown[]   = []
  let p = 1

  const VALID_STATUSES = [
    'to_schedule', 'scheduled', 'confirmed', 'rescheduled', 'postponed', 'completed',
    'cancelled', 'no_show', 'interviewer_no_show', 'selected', 'awaiting_feedback',
    'rejected', 'offer_discussion',
  ]

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` }, { status: 422 })
    }
    updates.push(`status = $${p++}`); vals.push(body.status)
  }
  if (body.scheduled_at === null || body.scheduled_at === '') {
    updates.push(`scheduled_at = $${p++}`); vals.push(null)
    if (body.status === undefined) {
      updates.push(`status = $${p++}`); vals.push('to_schedule')
    }
  } else if (body.scheduled_at) {
    const dt = new Date(body.scheduled_at)
    if (isNaN(dt.getTime())) return NextResponse.json({ error: 'Invalid scheduled_at' }, { status: 422 })
    updates.push(`scheduled_at = $${p++}`); vals.push(dt.toISOString())
    if (body.status === undefined && (oldStatus === 'to_schedule' || !oldStatus)) {
      updates.push(`status = $${p++}`); vals.push('scheduled')
    }
  }
  if (body.round !== undefined) {
    const r = Number(body.round)
    if (!Number.isFinite(r) || r < 1 || r > 20) {
      return NextResponse.json({ error: 'round must be 1–20' }, { status: 422 })
    }
    updates.push(`round = $${p++}`); vals.push(Math.floor(r))
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

  let updated: { id: string; short_id: string; status: string; scheduled_at?: string | null; meet_link?: string | null }[]
  try {
    const q = await pool.query(
      `UPDATE interviews SET ${updates.join(', ')}
       WHERE id = $${p} AND tenant_id = $${p + 1}
       RETURNING id, short_id, status, scheduled_at`,
      [...vals, id, ctx.tenantId],
    )
    updated = q.rows
  } catch (e) {
    const wantFallback = body.status === 'selected' || body.status === 'to_schedule'
    if (!wantFallback) throw e
    const fallback = body.status === 'selected' ? 'completed' : 'scheduled'
    try {
      const q = await pool.query(
        `UPDATE interviews SET status = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3
         RETURNING id, short_id, status, scheduled_at`,
        [fallback, id, ctx.tenantId],
      )
      updated = q.rows
    } catch (e2) {
      console.error('[interviews PATCH] status fallback failed', e2)
      const q = await pool.query(
        `SELECT id, short_id, status, scheduled_at FROM interviews WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId],
      )
      updated = q.rows
    }
  }

  if (!updated?.length) {
    return NextResponse.json({ error: 'Interview update failed' }, { status: 500 })
  }

  const newStatus = (body.status === 'selected' ? 'selected' : updated[0]?.status) as string
  try {
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
    if (newStatus !== oldStatus) {
    const statusTitles: Record<string, string> = {
      to_schedule: 'Interview — awaiting slot',
      scheduled: 'Interview Scheduled',
      confirmed: 'Interview Confirmed',
      rescheduled: 'Interview Rescheduled',
      completed: 'Interview Completed',
      cancelled: 'Interview Cancelled',
      no_show: 'Interview No-Show',
      selected: 'Candidate Selected',
      awaiting_feedback: 'Awaiting Interview Feedback',
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
    if (newStatus === 'completed' || newStatus === 'selected') {
      await runCollaborativeChain({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        triggerEvent: newStatus === 'selected' ? 'candidate_selected' : 'interview_completed',
        resumeId: interview.resume_id,
        jobPostId: interview.job_post_id,
        entityType: 'interview',
        entityId: id,
        candidateName: interview.candidate_name,
      })
    }
    if (newStatus === 'rejected' || newStatus === 'no_show' || newStatus === 'cancelled') {
      let submissionId: string | null = null
      try {
        const sub = await pool.query<{ id: string }>(
          `SELECT id FROM submissions
           WHERE tenant_id = $1 AND resume_id = $2
             AND ($3::uuid IS NULL OR job_post_id = $3)
           ORDER BY updated_at DESC LIMIT 1`,
          [ctx.tenantId, interview.resume_id, interview.job_post_id],
        )
        submissionId = sub.rows[0]?.id ?? null
        if (submissionId && newStatus !== 'cancelled') {
          await pool.query(
            `UPDATE submissions SET stage = 'rejected', updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2
               AND stage NOT IN ('joined','submission_withdrawn')`,
            [submissionId, ctx.tenantId],
          )
        }
      } catch { /* ignore */ }
      await closeShareForJob({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resumeId: interview.resume_id,
        jobPostId: interview.job_post_id,
        submissionId,
        reason: `interview_${newStatus}`,
      })
    }
    if (newStatus === 'selected' || newStatus === 'offer_discussion') {
      let submissionId: string | null = null
      try {
        const sub = await pool.query<{ id: string }>(
          `SELECT id FROM submissions
           WHERE tenant_id = $1 AND resume_id = $2
             AND ($3::uuid IS NULL OR job_post_id = $3)
             AND stage NOT IN ('rejected','rejected_by_candidate','submission_withdrawn','position_closed')
           ORDER BY updated_at DESC LIMIT 1`,
          [ctx.tenantId, interview.resume_id, interview.job_post_id],
        )
        submissionId = sub.rows[0]?.id ?? null
      } catch { /* ignore */ }
      await ensureOfferForSelection({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resumeId: interview.resume_id,
        submissionId,
        jobPostId: interview.job_post_id,
        interviewId: id,
        candidateName: interview.candidate_name,
      })
    }
    const nextLife = interviewStatusToLifecycle(newStatus)
    const skipPersonReject = nextLife === 'rejected'
      && await hasOtherOpenSubmissions({
        tenantId: ctx.tenantId,
        resumeId: interview.resume_id,
      })
    if (!skipPersonReject) {
      await advanceFromDomain({
        tenantId: ctx.tenantId,
        resumeId: interview.resume_id,
        toStage: nextLife,
        jobPostId: interview.job_post_id,
        relatedEntityType: 'interview',
        relatedEntityId: id,
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        reason: `interview_status:${oldStatus}->${newStatus}`,
      })
    }
    }
  } catch (e) {
    console.error('[interviews PATCH] after save (update still applied)', e)
  }

  return NextResponse.json({ interview: updated[0] })
  } catch (e) {
    console.error('[interviews PATCH]', e)
    return NextResponse.json(
      { error: 'Interview update failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
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
