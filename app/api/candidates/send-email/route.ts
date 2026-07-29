/**
 * POST /api/candidates/send-email — Candidate 360 send via existing email OAuth
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

  let body: { resume_id?: string; to?: string; subject?: string; html?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.resume_id || !isValidUUID(body.resume_id) || !body.subject || !body.html) {
    return NextResponse.json({ error: 'resume_id, subject, and html are required' }, { status: 422 })
  }

  const { rows } = await pool.query(
    `SELECT id, candidate_name, candidate_email FROM resumes
     WHERE id = $1 AND tenant_id = $2`,
    [body.resume_id, ctx.tenantId]
  )
  const cand = rows[0]
  if (!cand) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const to = body.to || cand.candidate_email
  if (!to) return NextResponse.json({ error: 'No recipient email' }, { status: 422 })

  try {
    const result = await sendEmailFromTenant(ctx.tenantId, ctx.userId, {
      to, subject: body.subject, html: body.html,
    })
    await insertCommLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      channel: 'email',
      to,
      subject: body.subject,
      body: body.html.replace(/<[^>]+>/g, ' ').trim(),
      status: 'sent',
      deliveryStatus: 'sent',
      resumeId: body.resume_id,
    }).catch(() => {})
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'candidate',
      entityId: body.resume_id,
      resumeId: body.resume_id,
      eventType: 'email_sent',
      title: 'Email sent',
      detail: body.subject,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
    }).catch(() => {})
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'candidate_email_sent', resourceType: 'resume', resourceId: body.resume_id,
      details: { to, sent_via: result.sent_via }, module: 'integrations',
      resumeId: body.resume_id,
    })
    return NextResponse.json({ ok: true, sent_via: result.sent_via, from: result.from })
  } catch (err) {
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'candidate_email_failed', resourceType: 'resume', resourceId: body.resume_id,
      details: { error: err instanceof Error ? err.message : String(err) },
      module: 'integrations', result: 'failure',
    })
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Send failed',
    }, { status: 500 })
  }
}
