/**
 * POST /api/offers/send-email — email offer letter via connected OAuth / SMTP
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { sendEmailFromTenant } from '@/lib/email-oauth'
import { logAudit } from '@/lib/audit'
import { insertCommLog } from '@/lib/commLog'
import { writeTimeline } from '@/lib/timelineEngine'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: { offer_id?: string; subject?: string; html?: string; to?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.offer_id || !isValidUUID(body.offer_id)) {
    return NextResponse.json({ error: 'offer_id required' }, { status: 422 })
  }

  const { rows } = await pool.query(
    `SELECT o.*, r.candidate_name, r.candidate_email, r.id AS resume_id
     FROM offer_cases o
     JOIN resumes r ON r.id = o.resume_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [body.offer_id, ctx.tenantId]
  )
  const offer = rows[0]
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

  const to = body.to || offer.candidate_email
  if (!to) return NextResponse.json({ error: 'Candidate has no email' }, { status: 422 })

  const subject = body.subject || `Offer — ${offer.candidate_name || 'Candidate'}`
  const html = body.html || `
    <p>Dear ${offer.candidate_name || 'Candidate'},</p>
    <p>We are pleased to share your offer details.</p>
    <p>Status: <strong>${offer.status}</strong></p>
    <p>Please reply to this email with any questions.</p>
    <p>Best regards</p>`

  try {
    const result = await sendEmailFromTenant(ctx.tenantId, ctx.userId, { to, subject, html })
    await insertCommLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      channel: 'email',
      to,
      subject,
      body: html.replace(/<[^>]+>/g, ' ').trim(),
      status: 'sent',
      deliveryStatus: 'sent',
      resumeId: offer.resume_id,
    }).catch(() => {})
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'candidate',
      entityId: offer.resume_id,
      resumeId: offer.resume_id,
      eventType: 'email_sent',
      title: 'Offer email sent',
      detail: subject,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
    }).catch(() => {})
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'offer_email_sent', resourceType: 'offer', resourceId: body.offer_id,
      details: { to, sent_via: result.sent_via }, module: 'integrations',
      resumeId: offer.resume_id,
    })
    return NextResponse.json({ ok: true, sent_via: result.sent_via, from: result.from })
  } catch (err) {
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'offer_email_failed', resourceType: 'offer', resourceId: body.offer_id,
      details: { error: err instanceof Error ? err.message : String(err) },
      module: 'integrations', result: 'failure',
    })
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Send failed',
    }, { status: 500 })
  }
}
