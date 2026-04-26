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

function newInterviewId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'INT-'
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const url       = new URL(req.url)
  const jobId     = url.searchParams.get('job_id')
  const resumeId  = url.searchParams.get('resume_id')
  const status    = url.searchParams.get('status')
  const dateFrom  = url.searchParams.get('date_from')
  const dateTo    = url.searchParams.get('date_to')
  const page      = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const limit     = 25
  const offset    = (page - 1) * limit

  const conditions: string[] = ['i.tenant_id = $1']
  const params: unknown[]    = [ctx.tenantId]
  let p = 2

  if (jobId)    { conditions.push(`i.job_post_id = $${p++}`);  params.push(jobId) }
  if (resumeId) { conditions.push(`i.resume_id = $${p++}`);    params.push(resumeId) }
  if (status)   { conditions.push(`i.status = $${p++}`);        params.push(status) }
  if (dateFrom) { conditions.push(`i.scheduled_at >= $${p++}`); params.push(dateFrom) }
  if (dateTo)   { conditions.push(`i.scheduled_at <= $${p++}`); params.push(dateTo) }

  const where = conditions.join(' AND ')

  const { rows } = await pool.query(
    `SELECT
       i.id, i.short_id, i.job_post_id, i.resume_id,
       i.candidate_name, i.candidate_email,
       i.interviewer_id, i.scheduled_at, i.duration_minutes,
       i.format, i.status, i.meet_link, i.calendar_event_id,
       i.platform, i.location, i.notes, i.rating, i.feedback,
       i.created_at, i.updated_at,
       jp.title AS job_title,
       au.name AS interviewer_name,
       au.email AS interviewer_email
     FROM interviews i
     LEFT JOIN job_posts jp ON jp.id = i.job_post_id
     LEFT JOIN auth_users au ON au.id = i.interviewer_id
     WHERE ${where}
     ORDER BY i.scheduled_at ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  )

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM interviews i WHERE ${where}`,
    params
  )

  return NextResponse.json({ interviews: rows, total: Number(countRows[0].total), page })
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
  const shortId       = newInterviewId()

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

  // Insert interview record
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

  const interview = inserted[0]

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

  return NextResponse.json({ interview: inserted[0], calendar_provider: calendarProvider }, { status: 201 })
}
