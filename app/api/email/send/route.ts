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

  try {
    const result = await sendEmailFromTenant(ctx.tenantId, ctx.userId, {
      to:      body.to,
      cc:      body.cc,
      subject: body.subject,
      html:    body.html,
      text:    body.text,
      replyTo: body.replyTo,
    })

    await logAudit({
      userId:       ctx.userId,
      userEmail:    ctx.userEmail,
      tenantId:     ctx.tenantId,
      action:       'email_sent',
      resourceType: 'email',
      details: {
        to:       toList,
        subject:  body.subject,
        sent_via: result.sent_via,
        from:     result.from,
      },
    })

    return NextResponse.json({ ok: true, sent_via: result.sent_via, from: result.from })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/send]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
