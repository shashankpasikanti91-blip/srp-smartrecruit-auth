/**
 * app/api/interviews/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Interview scheduling — creates entries + real calendar events.
 *
 * GET    /api/interviews             — list interviews for tenant (filters: job_id, status, date_from, date_to)
 * POST   /api/interviews             — schedule interview (creates calendar event, generates meet link)
 * PATCH  /api/interviews/[id]        — update status / reschedule / add feedback
 * DELETE /api/interviews/[id]        — cancel and delete calendar event
 *
 * Short ID format: INT-XXXXXXXX
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse }     from 'next/server'
import { requireTenant }                 from '@/lib/tenant'
import { pool }                          from '@/lib/db'
import { logAudit }                      from '@/lib/audit'
import { createInterviewEvent }          from '@/lib/calendar'
import { sendEmailFromTenant }           from '@/lib/email-oauth'
import { nextYearSeqId }                 from '@/lib/recruitmentOs'
import { ensureAutoFollowUp }            from '@/lib/autoFollowUps'
import { scheduleInterviewReminders }    from '@/lib/reminderEngine'
import { writeTimeline }                 from '@/lib/timelineEngine'
import { createNotification }            from '@/lib/notificationCenter'
import { upsertWorkflowInstance }        from '@/lib/workflowEngine'
import { resolveDateFilter, resolveMineScope } from '@/lib/opsList'
import { sanitizeText } from '@/lib/validate'
import { advanceFromDomain, interviewStatusToLifecycle } from '@/lib/lifecycle'

async function newInterviewId(tenantId: string): Promise<string> {
  return nextYearSeqId(pool, { tenantId, table: 'interviews', prefix: 'INT' })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const url       = new URL(req.url)
  const jobId     = url.searchParams.get('job_id')
  const resumeId  = url.searchParams.get('resume_id')
  const status    = sanitizeText(url.searchParams.get('status'), 50) ?? ''
  const q         = sanitizeText(url.searchParams.get('q'), 200) ?? ''
  const page      = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const limit     = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 100)))
  const offset    = (page - 1) * limit
  const dateRange = resolveDateFilter(url.searchParams)
  const { mine, canToggle } = resolveMineScope(ctx, url.searchParams.get('mine'))

  const conditions: string[] = ['i.tenant_id = $1']
  const params: unknown[]    = [ctx.tenantId]
  let p = 2

  if (jobId)    { conditions.push(`i.job_post_id = $${p++}`);  params.push(jobId) }
  if (resumeId) { conditions.push(`i.resume_id = $${p++}`);    params.push(resumeId) }
  if (status)   { conditions.push(`i.status = $${p++}`);        params.push(status) }
  if (q) {
    conditions.push(`(
      i.candidate_name ILIKE $${p} OR i.candidate_email ILIKE $${p}
      OR i.short_id ILIKE $${p} OR COALESCE(r.short_id,'') ILIKE $${p}
      OR COALESCE(r.candidate_phone,'') ILIKE $${p}
      OR COALESCE(jp.title,'') ILIKE $${p}
    )`)
    params.push(`%${q}%`)
    p++
  }
  if (mine) {
    conditions.push(`(i.interviewer_id = $${p} OR r.user_id = $${p})`)
    params.push(ctx.userId)
    p++
  }
  if (dateRange) {
    conditions.push(`i.scheduled_at::date >= $${p++}::date`)
    params.push(dateRange.from)
    conditions.push(`i.scheduled_at::date <= $${p++}::date`)
    params.push(dateRange.to)
  }

  const where = conditions.join(' AND ')
  const fromSql = `
     FROM interviews i
     LEFT JOIN resumes r ON r.id = i.resume_id
     LEFT JOIN job_posts jp ON jp.id = i.job_post_id
     LEFT JOIN clients cl ON cl.id = jp.client_id
     LEFT JOIN auth_users au ON au.id = i.interviewer_id`

  const { rows } = await pool.query(
    `SELECT
       i.*,
       jp.title AS job_title,
       COALESCE(jp.company, cl.name) AS job_client_name,
       au.name AS interviewer_name,
       au.email AS interviewer_email,
       r.short_id AS candidate_short_id,
       r.candidate_phone,
       COALESCE(r.candidate_email, i.candidate_email) AS resume_email,
       COALESCE(
         NULLIF(r.candidate_profile->>'years_experience',''),
         NULLIF(r.candidate_profile->>'total_experience',''),
         NULLIF(r.candidate_profile->>'experience_years','')
       ) AS years_experience,
       NULLIF(r.candidate_profile->>'current_salary','') AS current_salary,
       COALESCE(
         NULLIF(r.candidate_profile->>'expected_salary',''),
         NULLIF(r.candidate_profile->>'salary_expectation','')
       ) AS expected_salary
     ${fromSql}
     WHERE ${where}
     ORDER BY
       CASE WHEN LOWER(COALESCE(i.status, '')) IN ('completed', 'cancelled', 'canceled', 'no_show', 'noshow') THEN 1 ELSE 0 END ASC,
       CASE WHEN LOWER(COALESCE(i.status, '')) IN ('completed', 'cancelled', 'canceled', 'no_show', 'noshow') THEN i.scheduled_at END DESC NULLS LAST,
       i.scheduled_at ASC NULLS LAST
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  )

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total ${fromSql} WHERE ${where}`,
    params
  )

  // Status summary with same scope filters except status
  const sumConditions = ['i.tenant_id = $1']
  const sumParams: unknown[] = [ctx.tenantId]
  let sp = 2
  if (jobId) { sumConditions.push(`i.job_post_id = $${sp++}`); sumParams.push(jobId) }
  if (resumeId) { sumConditions.push(`i.resume_id = $${sp++}`); sumParams.push(resumeId) }
  if (q) {
    sumConditions.push(`(
      i.candidate_name ILIKE $${sp} OR i.candidate_email ILIKE $${sp}
      OR i.short_id ILIKE $${sp} OR COALESCE(r.short_id,'') ILIKE $${sp}
      OR COALESCE(r.candidate_phone,'') ILIKE $${sp}
      OR COALESCE(jp.title,'') ILIKE $${sp}
    )`)
    sumParams.push(`%${q}%`)
    sp++
  }
  if (mine) {
    sumConditions.push(`(i.interviewer_id = $${sp} OR r.user_id = $${sp})`)
    sumParams.push(ctx.userId)
    sp++
  }
  if (dateRange) {
    sumConditions.push(`i.scheduled_at::date >= $${sp++}::date`)
    sumParams.push(dateRange.from)
    sumConditions.push(`i.scheduled_at::date <= $${sp++}::date`)
    sumParams.push(dateRange.to)
  }
  const sumWhere = sumConditions.join(' AND ')
  const { rows: statusRows } = await pool.query<{ status: string; c: string }>(
    `SELECT i.status, COUNT(*)::text AS c
     FROM interviews i
     LEFT JOIN resumes r ON r.id = i.resume_id
     LEFT JOIN job_posts jp ON jp.id = i.job_post_id
     WHERE ${sumWhere}
     GROUP BY i.status`,
    sumParams,
  )
  const byStatus: Record<string, number> = {}
  let all = 0
  for (const row of statusRows) {
    const n = parseInt(row.c, 10)
    byStatus[row.status] = n
    all += n
  }

  return NextResponse.json({
    interviews: rows,
    total: Number(countRows[0].total),
    page,
    limit,
    mine,
    can_toggle_mine: canToggle,
    summary: { all, by_status: byStatus },
  })
}

// ── POST — schedule interview ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: {
    resume_id:        string
    job_post_id?:     string
    candidate_name:   string
    candidate_email:  string
    interviewer_id?:  string  // defaults to requesting user
    scheduled_at:     string  // ISO 8601 datetime
    duration_minutes?: number // default 60
    format?:          'video' | 'phone' | 'in_person'
    platform?:        'google_meet' | 'teams' | 'zoom' | 'other'
    location?:        string
    notes?:           string
    send_invite?:     boolean // default true — send email invite to candidate
    create_calendar?: boolean // default true — create calendar event
    additional_attendees?: string[]
    round?:           number
    timezone?:        string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.resume_id || !body.candidate_name || !body.candidate_email || !body.scheduled_at) {
    return NextResponse.json({
      error: '`resume_id`, `candidate_name`, `candidate_email`, and `scheduled_at` are required',
    }, { status: 422 })
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRx.test(body.candidate_email)) {
    return NextResponse.json({ error: 'Invalid candidate_email' }, { status: 422 })
  }

  const scheduledAt   = new Date(body.scheduled_at)
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'Invalid scheduled_at datetime' }, { status: 422 })
  }

  const durationMins  = body.duration_minutes ?? 60
  const interviewerId = body.interviewer_id ?? ctx.userId
  const format        = body.format ?? 'video'
  const shortId       = await newInterviewId(ctx.tenantId)
  const round         = body.round ?? 1
  const timezone      = body.timezone ?? 'Asia/Kuala_Lumpur'

  let meetLink:        string | null = null
  let calendarEventId: string | null = null
  let calendarProvider: string | null = null

  // Create calendar event
  const createCal = body.create_calendar !== false
  if (createCal) {
    const endAt   = new Date(scheduledAt.getTime() + durationMins * 60 * 1000)
    const attendees = [body.candidate_email, ...(body.additional_attendees ?? [])]

    // Get interviewer email
    const { rows: ivRows } = await pool.query(
      `SELECT email, name FROM auth_users WHERE id = $1`,
      [interviewerId]
    )
    if (ivRows[0]?.email) attendees.unshift(ivRows[0].email)

    try {
      const calResult = await createInterviewEvent(ctx.tenantId, interviewerId, {
        summary:     `Interview: ${body.candidate_name} — ${body.job_post_id ? 'Job' : 'Screening'}`,
        description: [
          `Candidate: ${body.candidate_name} (${body.candidate_email})`,
          body.notes ? `Notes: ${body.notes}` : '',
          `Interview ID: ${shortId}`,
        ].filter(Boolean).join('\n'),
        start:       scheduledAt,
        end:         endAt,
        attendees,
        location:    body.location,
      })
      meetLink        = calResult.meet_link
      calendarEventId = calResult.calendar_event_id
      calendarProvider = calResult.provider
    } catch (calErr) {
      // Calendar creation failure is non-blocking — log and continue
      console.warn('[interviews] Calendar event creation failed:', calErr)
    }
  }

  // Insert interview record (round/timezone require v22 migration — fall back if missing)
  let interview: { id: string; short_id: string; scheduled_at: string; meet_link: string | null; calendar_event_id: string | null; status: string }
  try {
    const { rows: inserted } = await pool.query(
      `INSERT INTO interviews
         (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
          interviewer_id, scheduled_at, duration_minutes, format, platform,
          location, notes, status, meet_link, calendar_event_id, round, timezone, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'scheduled',$14,$15,$16,$17,NOW())
       RETURNING id, short_id, scheduled_at, meet_link, calendar_event_id, status`,
      [
        shortId, ctx.tenantId, body.resume_id, body.job_post_id ?? null,
        body.candidate_name, body.candidate_email,
        interviewerId, scheduledAt.toISOString(), durationMins,
        format, body.platform ?? (calendarProvider === 'google' ? 'google_meet' : calendarProvider === 'outlook' ? 'teams' : 'other'),
        body.location ?? null, body.notes ?? null,
        meetLink, calendarEventId, round, timezone,
      ]
    )
    interview = inserted[0]
  } catch {
    const { rows: inserted } = await pool.query(
      `INSERT INTO interviews
         (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
          interviewer_id, scheduled_at, duration_minutes, format, platform,
          location, notes, status, meet_link, calendar_event_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'scheduled',$14,$15,NOW())
       RETURNING id, short_id, scheduled_at, meet_link, calendar_event_id, status`,
      [
        shortId, ctx.tenantId, body.resume_id, body.job_post_id ?? null,
        body.candidate_name, body.candidate_email,
        interviewerId, scheduledAt.toISOString(), durationMins,
        format, body.platform ?? (calendarProvider === 'google' ? 'google_meet' : calendarProvider === 'outlook' ? 'teams' : 'other'),
        body.location ?? null, body.notes ?? null,
        meetLink, calendarEventId,
      ]
    )
    interview = inserted[0]
  }

  await ensureAutoFollowUp({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resumeId: body.resume_id,
    interviewId: interview.id,
    title: `Interview reminder — ${body.candidate_name}`,
    dueAt: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
    source: 'interview_reminder',
    channel: 'other',
    notes: `Auto reminder 1h before interview ${shortId}`,
  })

  await scheduleInterviewReminders({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resumeId: body.resume_id,
    interviewId: interview.id,
    scheduledAt,
    candidateName: body.candidate_name,
  })

  await writeTimeline({
    tenantId: ctx.tenantId,
    entityType: 'interview',
    entityId: interview.id,
    resumeId: body.resume_id,
    eventType: 'interview_scheduled',
    title: 'Interview Scheduled',
    detail: `${shortId} · ${scheduledAt.toISOString()}`,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
  })

  await createNotification({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    category: 'interview',
    title: `Interview scheduled — ${body.candidate_name}`,
    body: `${shortId} at ${scheduledAt.toLocaleString()}`,
    resumeId: body.resume_id,
    entityType: 'interview',
    entityId: interview.id,
  })

  const feedbackSla = new Date(scheduledAt.getTime() + 24 * 3600_000)
  await upsertWorkflowInstance({
    tenantId: ctx.tenantId,
    entityType: 'interview',
    entityId: interview.id,
    stage: 'scheduled',
    resumeId: body.resume_id,
    jobPostId: body.job_post_id ?? null,
    slaDueAt: feedbackSla,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    detail: 'Feedback due 24h after scheduled interview',
  })

  await advanceFromDomain({
    tenantId: ctx.tenantId,
    resumeId: body.resume_id,
    toStage: interviewStatusToLifecycle('scheduled'),
    jobPostId: body.job_post_id ?? null,
    relatedEntityType: 'interview',
    relatedEntityId: interview.id,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    reason: 'interview_scheduled',
  })

  // Send invite email to candidate
  const sendInvite = body.send_invite !== false
  if (sendInvite) {
    const dateStr = scheduledAt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'long',
      timeStyle: 'short',
    })

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden">
        <div style="background:#1e40af;padding:32px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">Interview Invitation</h1>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:16px">Dear <strong>${body.candidate_name}</strong>,</p>
          <p style="color:#374151">You have been invited for an interview. Here are the details:</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:10px;background:#f3f4f6;border-radius:6px;font-weight:600;color:#6b7280;width:140px">Date &amp; Time</td>
                <td style="padding:10px;color:#111827">${dateStr} IST</td></tr>
            <tr><td style="padding:10px;font-weight:600;color:#6b7280">Duration</td>
                <td style="padding:10px;color:#111827">${durationMins} minutes</td></tr>
            <tr><td style="padding:10px;background:#f3f4f6;border-radius:6px;font-weight:600;color:#6b7280">Format</td>
                <td style="padding:10px;color:#111827;text-transform:capitalize">${format.replace('_', ' ')}</td></tr>
            ${meetLink ? `<tr><td style="padding:10px;font-weight:600;color:#6b7280">Meeting Link</td>
                <td style="padding:10px"><a href="${meetLink}" style="color:#2563eb">${meetLink}</a></td></tr>` : ''}
            ${body.location ? `<tr><td style="padding:10px;background:#f3f4f6;border-radius:6px;font-weight:600;color:#6b7280">Location</td>
                <td style="padding:10px;color:#111827">${body.location}</td></tr>` : ''}
          </table>
          ${body.notes ? `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:4px;margin-bottom:24px">
            <p style="margin:0;color:#1e40af;font-size:14px">${body.notes}</p>
          </div>` : ''}
          ${meetLink ? `<div style="text-align:center;margin:24px 0">
            <a href="${meetLink}" style="background:#2563eb;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Join Interview</a>
          </div>` : ''}
          <p style="color:#6b7280;font-size:13px">Interview ID: ${shortId}</p>
        </div>
      </div>
    `

    try {
      await sendEmailFromTenant(ctx.tenantId, ctx.userId, {
        to:      body.candidate_email,
        subject: `Interview Invitation — ${dateStr}`,
        html:    emailHtml,
      })
    } catch (emailErr) {
      console.warn('[interviews] Invite email failed:', emailErr)
      // Non-blocking
    }
  }

  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'interview_scheduled',
    resourceType: 'interview',
    resourceId:   interview.id,
    details: {
      short_id:       shortId,
      candidate:      body.candidate_name,
      scheduled_at:   scheduledAt.toISOString(),
      meet_link:      meetLink,
      calendar_event: calendarEventId,
    },
  })

  return NextResponse.json({ interview, calendar_provider: calendarProvider }, { status: 201 })
}
