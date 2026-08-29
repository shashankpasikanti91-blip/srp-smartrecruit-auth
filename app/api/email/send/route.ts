/**
 * app/api/email/send/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Send an email from this tenant's connected email provider.
 *
 * POST /api/email/send
 * Body:
 *   { to, cc?, subject, html, text?, replyTo? }
 *
 * Uses connected Gmail or Outlook OAuth token (with auto-refresh) for the
 * requesting user. Falls back to SMTP_* env vars if no OAuth connection found.
 *
 * GET /api/email/connections  — list this user's connected email accounts
 * DELETE /api/email/connections?provider= — disconnect a provider
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse }       from 'next/server'
import { requireTenant }                   from '@/lib/tenant'
import { sendEmailFromTenant,
         getEmailConnections,
         disconnectEmailProvider }         from '@/lib/email-oauth'
import { logAudit }                        from '@/lib/audit'
import { insertCommLog }                   from '@/lib/commLog'
import { writeTimeline }                   from '@/lib/timelineEngine'
import { isValidUUID }                     from '@/lib/validate'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: {
    to:       string | string[]
    cc?:      string | string[]
    subject:  string
    html:     string
    text?:    string
    replyTo?: string
    resume_id?: string
    job_post_id?: string
    client_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json({ error: '`to`, `subject`, and `html` are required' }, { status: 422 })
  }

  // Basic email validation
  const toList = Array.isArray(body.to) ? body.to : [body.to]
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const addr of toList) {
    if (!emailRx.test(addr)) {
      return NextResponse.json({ error: `Invalid email address: ${addr}` }, { status: 422 })
    }
  }

  const plain = body.text || body.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  try {
    const result = await sendEmailFromTenant(ctx.tenantId, ctx.userId, {
      to:      body.to,
      cc:      body.cc,
      subject: body.subject,
      html:    body.html,
      text:    body.text,
      replyTo: body.replyTo,
    })

    const logId = await insertCommLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      channel: 'email',
      to: toList.join(', '),
      subject: body.subject,
      body: plain,
      status: 'sent',
      deliveryStatus: 'sent',
      resumeId: body.resume_id && isValidUUID(body.resume_id) ? body.resume_id : null,
      jobPostId: body.job_post_id && isValidUUID(body.job_post_id) ? body.job_post_id : null,
      clientId: body.client_id && isValidUUID(body.client_id) ? body.client_id : null,
      direction: 'outbound',
    })

    if (body.resume_id && isValidUUID(body.resume_id)) {
      await writeTimeline({
        tenantId: ctx.tenantId,
        entityType: 'email',
        entityId: logId ?? body.resume_id,
        resumeId: body.resume_id,
        eventType: 'comm_sent',
        title: 'Email sent',
        detail: `${body.subject} → ${toList.join(', ')}`,
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        meta: { sent_via: result.sent_via, from: result.from, job_post_id: body.job_post_id },
      })
    }

    await logAudit({
      userId:       ctx.userId,
      userEmail:    ctx.userEmail,
      tenantId:     ctx.tenantId,
      action:       'email_sent',
      resourceType: 'email',
      resumeId:     body.resume_id && isValidUUID(body.resume_id) ? body.resume_id : undefined,
      details: {
        to:       toList,
        subject:  body.subject,
        sent_via: result.sent_via,
        from:     result.from,
        log_id:   logId,
      },
      module: 'comms',
    })

    return NextResponse.json({ ok: true, sent_via: result.sent_via, from: result.from, id: logId })
  } catch (err: unknown) {
    console.error('[email/send]', err)
    await insertCommLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      channel: 'email',
      to: toList.join(', '),
      subject: body.subject,
      body: plain,
      status: 'failed',
      deliveryStatus: 'failed',
      errorMsg: err instanceof Error ? err.message : 'send failed',
      resumeId: body.resume_id ?? null,
      jobPostId: body.job_post_id ?? null,
      clientId: body.client_id ?? null,
    }).catch(() => null)
    return NextResponse.json({ error: 'Could not send email. Please try again.' }, { status: 502 })
  }
}
