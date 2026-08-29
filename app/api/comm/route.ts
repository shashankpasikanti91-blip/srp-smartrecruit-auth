import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import { requireTenant } from '@/lib/tenant'
import { writeTimeline } from '@/lib/timelineEngine'
import { logAudit } from '@/lib/audit'
import { isValidUUID } from '@/lib/validate'
import { insertCommLog } from '@/lib/commLog'

export const maxDuration = 30

/** Escape user/template text before embedding in HTML email bodies (CWE-79). */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToSafeHtml(body: string): string {
  return escapeHtml(body).replace(/\n/g, '<br>')
}

const CHANNEL_MAP: Record<string, string> = {
  smtp: 'email', outlook: 'email', sendgrid: 'email', mailgun: 'email', gmail: 'email',
  telegram: 'telegram', whatsapp: 'whatsapp',
}

async function dispatchMessage(
  connector_id: string,
  cfg: Record<string, string>,
  to: string,
  subject: string,
  body: string,
): Promise<{ providerMessageId?: string }> {
  switch (connector_id) {
    case 'smtp':
    case 'outlook':
      await sendViaSMTP(cfg, to, subject, body); return {}
    case 'sendgrid':
      await sendViaSendGrid(cfg, to, subject, body); return {}
    case 'mailgun':
      await sendViaMailgun(cfg, to, subject, body); return {}
    case 'telegram':
      await sendViaTelegram(cfg, to, subject, body); return {}
    case 'whatsapp':
    case 'whatsapp_twilio_legacy':
      return await sendViaWhatsApp(cfg, to, subject, body)
    default:
      throw new Error(`Unsupported channel: ${connector_id}`)
  }
}

// ─── SMTP dispatcher ─────────────────────────────────────────────────────────
async function sendViaSMTP(
  cfg: Record<string, string>,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // nodemailer dynamically imported to keep cold-start fast
  const nodemailer = require('nodemailer')
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port ?? '587'),
    secure: cfg.port === '465',
    auth: { user: cfg.username, pass: cfg.password },
  })
  await transport.sendMail({
    from: `"${cfg.from_name ?? 'SRP Smartrecruit'}" <${cfg.from_email}>`,
    to,
    subject,
    text: body,
    html: textToSafeHtml(body),
  })
}

// ─── SendGrid dispatcher ─────────────────────────────────────────────────────
async function sendViaSendGrid(
  cfg: Record<string, string>,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: cfg.from_email, name: cfg.from_name ?? 'SRP Smartrecruit' },
      content: [{ type: 'text/plain', value: body }],
    }),
  })
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`)
}

// ─── Mailgun dispatcher ──────────────────────────────────────────────────────
async function sendViaMailgun(
  cfg: Record<string, string>,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const formData = new FormData()
  formData.append('from', `${cfg.from_name ?? 'SRP Smartrecruit'} <${cfg.from_email}>`)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('text', body)

  const res = await fetch(`https://api.mailgun.net/v3/${cfg.domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${cfg.api_key}`).toString('base64')}`,
    },
    body: formData,
  })
  if (!res.ok) throw new Error(`Mailgun ${res.status}: ${await res.text()}`)
}

// ─── Telegram dispatcher ─────────────────────────────────────────────────────
async function sendViaTelegram(
  cfg: Record<string, string>,
  to: string,
  _subject: string,
  body: string
): Promise<void> {
  const chatId = to || cfg.default_chat_id
  if (!chatId) throw new Error('Telegram chat_id required in "to" field or connector config')
  const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body, parse_mode: 'HTML' }),
  })
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`)
}

// ─── WhatsApp dispatcher (Meta Cloud SoT; Twilio legacy) ─────────────────────
async function sendViaWhatsApp(
  cfg: Record<string, string>,
  to: string,
  _subject: string,
  body: string
): Promise<{ providerMessageId?: string }> {
  // Meta WhatsApp Cloud API (V2 SoT)
  if (cfg.access_token && cfg.phone_number_id) {
    const version = (cfg.api_version || 'v19.0').replace(/^\/*/, '')
    const toDigits = to.replace(/^whatsapp:/i, '').replace(/\D/g, '')
    if (!toDigits) throw new Error('WhatsApp recipient phone required')
    const res = await fetch(
      `https://graph.facebook.com/${version}/${cfg.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toDigits,
          type: 'text',
          text: { body },
        }),
      }
    )
    const text = await res.text()
    if (!res.ok) throw new Error(`WhatsApp Meta ${res.status}: ${text}`)
    try {
      const json = JSON.parse(text) as { messages?: { id?: string }[] }
      return { providerMessageId: json.messages?.[0]?.id }
    } catch {
      return {}
    }
  }

  // Legacy Twilio path
  if (!cfg.account_sid || !cfg.auth_token || !cfg.whatsapp_number) {
    throw new Error('WhatsApp not configured — set Meta access_token + phone_number_id (preferred) or Twilio credentials')
  }
  const formData = new URLSearchParams()
  formData.append('From', cfg.whatsapp_number)
  formData.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`)
  formData.append('Body', body)

  const creds = Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString('base64')
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    }
  )
  const twText = await res.text()
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${twText}`)
  try {
    const json = JSON.parse(twText) as { sid?: string }
    return { providerMessageId: json.sid }
  } catch {
    return {}
  }
}

async function resolveSendConfig(
  userId: string,
  tenantId: string | null,
  connectorId: string,
): Promise<Record<string, string> | null> {
  const provRows = await pool.query(
    `SELECT config FROM communication_providers
     WHERE user_id = $1 AND provider_name = $2 AND is_active = true LIMIT 1`,
    [userId, connectorId]
  )
  if (provRows.rows.length) {
    const cfg = (provRows.rows[0].config as Record<string, string>) ?? {}
    if (connectorId !== 'whatsapp' || cfg.access_token || cfg.account_sid) return cfg
  }

  // Tenant Integrations SoT (WhatsApp Meta + email connectors)
  if (tenantId) {
    const emailSlugs = ['smtp', 'sendgrid', 'mailgun', 'outlook', 'gmail']
    if (connectorId === 'whatsapp' || connectorId === 'whatsapp_twilio_legacy') {
      const integ = await pool.query(
        `SELECT config FROM integrations
         WHERE tenant_id = $1 AND slug IN ('whatsapp', 'whatsapp_twilio_legacy')
         ORDER BY CASE WHEN slug = 'whatsapp' THEN 0 ELSE 1 END
         LIMIT 1`,
        [tenantId]
      )
      if (integ.rows[0]?.config) return integ.rows[0].config as Record<string, string>
    } else if (emailSlugs.includes(connectorId)) {
      const integ = await pool.query(
        `SELECT config FROM integrations
         WHERE tenant_id = $1 AND slug = $2
           AND COALESCE(config->>'connection_status', '') IN ('connected', 'not_tested')
         LIMIT 1`,
        [tenantId, connectorId]
      )
      if (integ.rows[0]?.config) return integ.rows[0].config as Record<string, string>
      // Prefer any connected email connector if exact slug missing
      if (connectorId === 'smtp' || connectorId === 'gmail') {
        const any = await pool.query(
          `SELECT slug, config FROM integrations
           WHERE tenant_id = $1 AND slug IN ('smtp','sendgrid','mailgun','outlook')
             AND config->>'connection_status' = 'connected'
           ORDER BY CASE slug WHEN 'smtp' THEN 0 WHEN 'sendgrid' THEN 1 WHEN 'mailgun' THEN 2 ELSE 3 END
           LIMIT 1`,
          [tenantId]
        )
        if (any.rows[0]?.config) return any.rows[0].config as Record<string, string>
      }
    }
  }
  if (provRows.rows[0]?.config) return provRows.rows[0].config as Record<string, string>
  return null
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const body = await req.json() as Record<string, unknown>
    const { action } = body as { action: string }

    // channel mapping
    const CHANNEL_MAP: Record<string, string> = {
      smtp: 'email', outlook: 'email', sendgrid: 'email', mailgun: 'email', gmail: 'email',
      telegram: 'telegram', whatsapp: 'whatsapp', sms: 'sms',
    }

    // ── Save / update provider ────────────────────────────────────────────
    if (action === 'save_provider') {
      const { connector_id, config } = body as {
        connector_id: string
        config: Record<string, string>
      }
      if (!connector_id) return NextResponse.json({ error: 'connector_id required' }, { status: 400 })
      const channel = CHANNEL_MAP[connector_id] ?? 'custom'
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO communication_providers (user_id, channel, provider_name, config, is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (user_id, channel, provider_name) DO UPDATE
           SET config = EXCLUDED.config, updated_at = NOW()
         RETURNING id`,
        [userId, channel, connector_id, JSON.stringify(config ?? {})]
      )
      return NextResponse.json({ id: rows[0]?.id, status: 'saved' })
    }

    // ── Toggle provider ───────────────────────────────────────────────────
    if (action === 'toggle_provider') {
      const { provider_id } = body as { provider_id: string }
      const { rows } = await pool.query<{ is_active: boolean }>(
        `UPDATE communication_providers SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 RETURNING is_active`,
        [provider_id, userId]
      )
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ is_active: rows[0].is_active })
    }

    // ── Save template ─────────────────────────────────────────────────────
    if (action === 'save_template') {
      const { name, subject, body: tmplBody, purpose, channel: tmplChannel } = body as {
        name: string; subject?: string; body: string
        purpose?: string; channel?: string
      }
      if (!name || !tmplBody) {
        return NextResponse.json({ error: 'name and body required' }, { status: 400 })
      }
      const VALID_PURPOSES = ['interview_invite','shortlist','rejection','follow_up','offer','reminder','welcome','custom']
      const VALID_CHANNELS = ['email','whatsapp','telegram','sms','all']
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO communication_templates
           (user_id, name, channel, purpose, subject, body_template)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          userId, name,
          VALID_CHANNELS.includes(tmplChannel ?? '') ? tmplChannel : 'all',
          VALID_PURPOSES.includes(purpose ?? '') ? purpose : 'custom',
          subject ?? '', tmplBody,
        ]
      )
      return NextResponse.json({ id: rows[0]?.id, status: 'saved' })
    }

    // ── Seed default templates ────────────────────────────────────────────
    if (action === 'seed_templates') {
      const defaults = [
        {
          name: 'Interview Invite',
          channel: 'email', purpose: 'interview_invite',
          subject: 'Interview Invitation – {{position}} at {{company}}',
          body: `Dear {{name}},

We are pleased to invite you for an interview for the role of {{position}} at {{company}}.

Interview Details:
• Date & Time: {{interview_date}}
• Format: {{interview_format}}
• Location / Link: {{location}}

Please confirm your availability by replying to this email.

Best regards,
{{recruiter_name}}
{{company}} Talent Team`,
        },
        {
          name: 'Shortlist Notification',
          channel: 'email', purpose: 'shortlist',
          subject: 'Great News – You\'ve Been Shortlisted for {{position}}',
          body: `Dear {{name}},

Congratulations! After reviewing your profile, we are pleased to inform you that you have been shortlisted for the {{position}} role at {{company}}.

Our recruitment team will be in touch shortly with next steps.

Best regards,
{{recruiter_name}}
{{company}} HR Team`,
        },
        {
          name: 'Rejection Email',
          channel: 'email', purpose: 'rejection',
          subject: 'Update on Your Application – {{position}}',
          body: `Dear {{name}},

Thank you for your interest in the {{position}} role at {{company}} and for taking the time to apply.

After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. This decision was not easy given the high calibre of candidates we received.

We will keep your profile on file for future opportunities that may be a better match.

Thank you again and we wish you success in your career search.

Best regards,
{{recruiter_name}}
{{company}} HR Team`,
        },
        {
          name: 'Offer Letter',
          channel: 'email', purpose: 'offer',
          subject: 'Offer of Employment – {{position}} at {{company}}',
          body: `Dear {{name}},

We are delighted to extend an offer of employment for the position of {{position}} at {{company}}.

Offer Details:
• Role: {{position}}
• Start Date: {{start_date}}
• Compensation: {{salary_package}}

Please review the attached formal offer letter and let us know your decision within 3 working days.

We look forward to welcoming you to the team!

Best regards,
{{recruiter_name}}
{{company}} HR Team`,
        },
        {
          name: 'Follow-up Reminder',
          channel: 'email', purpose: 'follow_up',
          subject: 'Following Up – {{position}} Application',
          body: `Dear {{name}},

I hope this message finds you well. I wanted to follow up regarding your application for the {{position}} role at {{company}}.

We are still in the process of reviewing applications and will be in touch with an update shortly.

Thank you for your patience.

Best regards,
{{recruiter_name}}`,
        },
        {
          name: 'WhatsApp Interview Invite',
          channel: 'whatsapp', purpose: 'interview_invite',
          subject: '',
          body: `Hi {{name}}! 👋

This is {{recruiter_name}} from {{company}}. We'd love to invite you for an interview for the *{{position}}* role.

📅 Date: {{interview_date}}
📍 Format: {{interview_format}}

Please reply YES to confirm or suggest another time. Looking forward to speaking with you!`,
        },
        {
          name: 'Welcome Onboard',
          channel: 'email', purpose: 'welcome',
          subject: 'Welcome to {{company}} – Next Steps',
          body: `Dear {{name}},

Welcome to {{company}}! We are thrilled to have you join our team as {{position}}.

Your start date is confirmed for {{start_date}}. Please find below the information you need for your first day:

• Reporting time: 9:00 AM
• Contact person: {{recruiter_name}}
• Documents to bring: ID proof, qualification certificates

If you have any questions before your start date, please don't hesitate to reach out.

Welcome aboard!

{{recruiter_name}}
{{company}}`,
        },
      ]

      let inserted = 0
      for (const t of defaults) {
        try {
          await pool.query(
            `INSERT INTO communication_templates (user_id, name, channel, purpose, subject, body_template)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT DO NOTHING`,
            [userId, t.name, t.channel, t.purpose, t.subject, t.body]
          )
          inserted++
        } catch { /* skip if already exists or schema mismatch */ }
      }
      return NextResponse.json({ inserted, status: 'seeded' })
    }

    // ── Retry failed message ──────────────────────────────────────────────
    if (action === 'retry') {
      const logId = body.log_id as string
      if (!isValidUUID(logId)) {
        return NextResponse.json({ error: 'log_id required' }, { status: 400 })
      }
      const tenantCtx = await requireTenant(req)
      const tenantId = tenantCtx instanceof NextResponse ? null : tenantCtx.tenantId
      const tenantEmail = tenantCtx instanceof NextResponse ? (session.user?.email ?? '') : tenantCtx.userEmail

      const { rows: logs } = await pool.query(
        `SELECT * FROM communication_logs WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [logId, userId]
      )
      if (!logs[0]) return NextResponse.json({ error: 'Log not found' }, { status: 404 })
      const prev = logs[0] as Record<string, unknown>
      const channel = String(prev.channel ?? 'email')
      const connector =
        channel === 'whatsapp' ? 'whatsapp'
          : channel === 'telegram' ? 'telegram'
            : 'smtp'

      const cfg = await resolveSendConfig(userId, tenantId, connector)
      if (!cfg) {
        return NextResponse.json({ error: 'No active provider for retry — configure Integrations or Communications → Providers' }, { status: 422 })
      }
      const connectorId = connector
      const to = String(prev.recipient ?? '')
      const finalSubject = String(prev.subject ?? '')
      const finalBody = String(prev.body ?? prev.body_preview ?? '')
      let status = 'sent'
      let errorMsg: string | null = null
      let providerMessageId: string | undefined
      try {
        const result = await dispatchMessage(connectorId, cfg, to, finalSubject, finalBody)
        providerMessageId = result.providerMessageId
      } catch (e) {
        status = 'failed'
        errorMsg = e instanceof Error ? e.message : String(e)
      }
      const newId = await insertCommLog({
        userId,
        tenantId,
        channel: CHANNEL_MAP[connectorId] ?? channel,
        to,
        subject: finalSubject,
        body: finalBody,
        status,
        errorMsg,
        resumeId: (prev.resume_id as string) ?? null,
        jobPostId: (prev.job_post_id as string) ?? null,
        clientId: (prev.client_id as string) ?? null,
        recruiterUserId: userId,
        retryOf: logId,
        threadKey: (prev.thread_key as string) ?? null,
        providerMessageId: providerMessageId ?? null,
        direction: 'outbound',
      })
      if (tenantId) {
        await logAudit({
          userId, userEmail: tenantEmail, tenantId,
          action: 'comm_retry', resourceType: 'communication', resourceId: newId ?? logId,
          resumeId: (prev.resume_id as string) ?? null, module: 'comms',
          details: { retry_of: logId, status, provider_message_id: providerMessageId },
        })
        if (prev.resume_id) {
          await writeTimeline({
            tenantId, entityType: channel === 'whatsapp' ? 'whatsapp' : 'email',
            entityId: newId ?? logId, resumeId: prev.resume_id as string,
            eventType: 'comm_retry', title: `Retry ${status}`,
            detail: to, actorUserId: userId, actorEmail: tenantEmail,
          })
        }
      }
      if (status === 'failed') return NextResponse.json({ error: errorMsg }, { status: 502 })
      return NextResponse.json({ status: 'sent', id: newId, provider_message_id: providerMessageId ?? null })
    }

    // ── Manual delivery / read status ─────────────────────────────────────
    if (action === 'mark_status') {
      const logId = body.log_id as string
      const delivery = String(body.delivery_status ?? body.status ?? '')
      if (!isValidUUID(logId) || !delivery) {
        return NextResponse.json({ error: 'log_id and delivery_status required' }, { status: 400 })
      }
      const sets: string[] = [`delivery_status = $1`]
      const vals: unknown[] = [delivery]
      let i = 2
      if (delivery === 'delivered') { sets.push(`status = 'sent'`) }
      if (delivery === 'opened' || delivery === 'read') {
        sets.push(`opened_at = COALESCE(opened_at, NOW())`)
        if (delivery === 'read') sets.push(`read_at = COALESCE(read_at, NOW())`)
      }
      if (delivery === 'failed') {
        sets.push(`status = 'failed'`)
        if (body.failed_reason) {
          sets.push(`failed_reason = $${i}`)
          vals.push(String(body.failed_reason).slice(0, 500))
          i++
        }
      }
      vals.push(logId, userId)
      await pool.query(
        `UPDATE communication_logs SET ${sets.join(', ')}
         WHERE id = $${i} AND user_id = $${i + 1}`,
        vals
      )
      return NextResponse.json({ status: 'updated', delivery_status: delivery })
    }

    // ── Send message ──────────────────────────────────────────────────────
    if (action === 'send') {
      const {
        connector_id, to, subject, message,
        template_id, template_vars,
        resume_id, job_post_id, client_id, thread_key,
      } = body as {
        connector_id: string
        to: string
        subject?: string
        message?: string
        template_id?: string
        template_vars?: Record<string, string>
        resume_id?: string
        job_post_id?: string
        client_id?: string
        thread_key?: string
      }

      if (!connector_id || !to) {
        return NextResponse.json({ error: 'connector_id and to are required' }, { status: 400 })
      }

      let finalSubject = subject ?? ''
      let finalBody = message ?? ''
      if (template_id) {
        const tmpl = await pool.query(
          `SELECT subject, body_template FROM communication_templates
           WHERE id = $1 AND user_id = $2 LIMIT 1`,
          [template_id, userId]
        )
        if (tmpl.rows.length) {
          finalSubject = renderTemplate(tmpl.rows[0].subject as string, template_vars ?? {})
          finalBody = renderTemplate(tmpl.rows[0].body_template as string, template_vars ?? {})
        }
      }
      if (!finalBody.trim()) {
        return NextResponse.json({ error: 'message body is empty' }, { status: 400 })
      }

      const tenantCtx = await requireTenant(req)
      const tenantId = tenantCtx instanceof NextResponse ? null : tenantCtx.tenantId
      const tenantEmail = tenantCtx instanceof NextResponse ? (session.user?.email ?? '') : tenantCtx.userEmail

      const cfg = await resolveSendConfig(userId, tenantId, connector_id)
      if (!cfg) {
        return NextResponse.json({
          error: connector_id === 'whatsapp'
            ? 'WhatsApp not configured. Open Integrations → WhatsApp Business (Meta), Save + Test Connection, then send here.'
            : `No active ${connector_id} provider configured. Go to Integrations or Communications → Providers.`,
        }, { status: 422 })
      }

      let status = 'sent'
      let errorMsg: string | null = null
      let providerMessageId: string | undefined

      try {
        const result = await dispatchMessage(connector_id, cfg, to, finalSubject, finalBody)
        providerMessageId = result.providerMessageId
      } catch (dispatchErr) {
        status = 'failed'
        errorMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr)
      }

      const logId = await insertCommLog({
        userId,
        tenantId,
        channel: CHANNEL_MAP[connector_id] ?? 'custom',
        to,
        subject: finalSubject,
        body: finalBody,
        status,
        errorMsg,
        resumeId: resume_id && isValidUUID(resume_id) ? resume_id : null,
        jobPostId: job_post_id && isValidUUID(job_post_id) ? job_post_id : null,
        clientId: client_id && isValidUUID(client_id) ? client_id : null,
        recruiterUserId: userId,
        threadKey: thread_key ?? resume_id ?? to,
        providerMessageId: providerMessageId ?? null,
        direction: 'outbound',
        recipientPhoneE164: CHANNEL_MAP[connector_id] === 'whatsapp' ? to.replace(/\D/g, '') : null,
      })

      if (tenantId && resume_id && isValidUUID(resume_id)) {
        await writeTimeline({
          tenantId,
          entityType: CHANNEL_MAP[connector_id] === 'whatsapp' ? 'whatsapp' : 'email',
          entityId: logId ?? resume_id,
          resumeId: resume_id,
          eventType: status === 'sent' ? 'comm_sent' : 'comm_failed',
          title: status === 'sent' ? 'Message sent' : 'Message failed',
          detail: `${CHANNEL_MAP[connector_id] ?? connector_id} → ${to}`,
          actorUserId: userId,
          actorEmail: tenantEmail,
          meta: { provider_message_id: providerMessageId, job_post_id, client_id },
        })
        await logAudit({
          userId, userEmail: tenantEmail, tenantId,
          action: status === 'sent' ? 'comm_sent' : 'comm_failed',
          resourceType: 'communication', resourceId: logId ?? undefined,
          resumeId: resume_id, module: 'comms',
          details: { to, channel: CHANNEL_MAP[connector_id], job_post_id, client_id },
        })
      }
      if (tenantId && job_post_id && isValidUUID(job_post_id) && (!resume_id || !isValidUUID(resume_id))) {
        await writeTimeline({
          tenantId,
          entityType: 'job',
          entityId: job_post_id,
          eventType: status === 'sent' ? 'comm_sent' : 'comm_failed',
          title: status === 'sent' ? 'Message sent' : 'Message failed',
          detail: `${CHANNEL_MAP[connector_id] ?? connector_id} → ${to}`,
          actorUserId: userId,
          actorEmail: tenantEmail,
        })
      }

      if (status === 'failed') {
        return NextResponse.json({ error: errorMsg }, { status: 502 })
      }
      return NextResponse.json({ status: 'sent', id: logId, provider_message_id: providerMessageId ?? null })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/comm]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string
  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'logs'

  try {
    if (type === 'providers') {
      const { rows } = await pool.query(
        `SELECT id, channel, provider_name AS connector_id, is_active, created_at
         FROM communication_providers WHERE user_id = $1 ORDER BY created_at`,
        [userId]
      )
      return NextResponse.json({ providers: rows })
    }
    if (type === 'templates') {
      const { rows } = await pool.query(
        `SELECT id, name, channel, purpose, subject, created_at
         FROM communication_templates WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      )
      return NextResponse.json({ templates: rows })
    }

    const channel = url.searchParams.get('channel')
    const status = url.searchParams.get('status')
    const resumeId = url.searchParams.get('resume_id')
    const jobId = url.searchParams.get('job_post_id')
    const clientId = url.searchParams.get('client_id')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const threadKey = url.searchParams.get('thread_key')
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '80', 10))

    const conditions = ['user_id = $1']
    const params: unknown[] = [userId]
    let p = 2

    // Prefer tenant scope when available
    const tenantCtx = await requireTenant(req)
    if (!(tenantCtx instanceof NextResponse)) {
      conditions[0] = '(user_id = $1 OR tenant_id = $2)'
      params.push(tenantCtx.tenantId)
      p = 3
    }

    if (channel === 'email') {
      conditions.push(`channel ILIKE $${p}`)
      params.push('%email%')
      p++
    } else if (channel === 'whatsapp') {
      conditions.push(`channel ILIKE $${p}`)
      params.push('%whatsapp%')
      p++
    } else if (channel) {
      conditions.push(`channel = $${p}`)
      params.push(channel)
      p++
    }
    if (status) {
      conditions.push(`(COALESCE(delivery_status, status) = $${p})`)
      params.push(status)
      p++
    }
    if (resumeId && isValidUUID(resumeId)) {
      conditions.push(`resume_id = $${p}`)
      params.push(resumeId)
      p++
    }
    if (jobId && isValidUUID(jobId)) {
      conditions.push(`job_post_id = $${p}`)
      params.push(jobId)
      p++
    }
    if (clientId && isValidUUID(clientId)) {
      conditions.push(`client_id = $${p}`)
      params.push(clientId)
      p++
    }
    if (threadKey) {
      conditions.push(`thread_key = $${p}`)
      params.push(threadKey)
      p++
    }
    if (dateFrom) {
      conditions.push(`created_at >= $${p}`)
      params.push(dateFrom)
      p++
    }
    if (dateTo) {
      conditions.push(`created_at <= $${p}`)
      params.push(dateTo)
      p++
    }

    const { rows } = await pool.query(
      `SELECT id, channel, recipient AS to_address, subject, body, body_preview, status,
              delivery_status, error_message, failed_reason, opened_at, read_at,
              resume_id, job_post_id, client_id, thread_key, retry_of, template_name,
              created_at, sent_at,
              COALESCE(direction, 'outbound') AS direction,
              provider_message_id
       FROM communication_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${p}`,
      [...params, limit]
    )
    return NextResponse.json({ logs: rows })
  } catch (err) {
    console.error('[api/comm GET]', err)
    const message = err instanceof Error ? err.message : 'Failed to load communications'
    return NextResponse.json({ error: message, logs: [] }, { status: 500 })
  }
}
