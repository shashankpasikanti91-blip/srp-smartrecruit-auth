import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export const maxDuration = 30

// ─── SMTP dispatcher ─────────────────────────────────────────────────────────
async function sendViaSMTP(
  cfg: Record<string, string>,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // nodemailer dynamically imported to keep cold-start fast
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    html: body.replace(/\n/g, '<br>'),
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

// ─── WhatsApp (Twilio) dispatcher ────────────────────────────────────────────
async function sendViaWhatsApp(
  cfg: Record<string, string>,
  to: string,
  _subject: string,
  body: string
): Promise<void> {
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
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`)
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

    // ── Send message ──────────────────────────────────────────────────────
    if (action === 'send') {
      const {
        connector_id, to, subject, message,
        template_id, template_vars,
      } = body as {
        connector_id: string
        to: string
        subject?: string
        message?: string
        template_id?: string
        template_vars?: Record<string, string>
      }

      if (!connector_id || !to) {
        return NextResponse.json({ error: 'connector_id and to are required' }, { status: 400 })
      }

      // Resolve template if provided
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

      // Get provider config (query by provider_name which matches connector_id)
      const provRows = await pool.query(
        `SELECT config FROM communication_providers
         WHERE user_id = $1 AND provider_name = $2 AND is_active = true LIMIT 1`,
        [userId, connector_id]
      )
      if (!provRows.rows.length) {
        return NextResponse.json({
          error: `No active ${connector_id} provider configured. Go to Communication Hub to set it up.`
        }, { status: 422 })
      }

      const cfg = provRows.rows[0].config as Record<string, string>
      let status = 'sent'
      let errorMsg: string | null = null

      try {
        switch (connector_id) {
          case 'smtp':
          case 'outlook':
            await sendViaSMTP(cfg, to, finalSubject, finalBody); break
          case 'sendgrid':
            await sendViaSendGrid(cfg, to, finalSubject, finalBody); break
          case 'mailgun':
            await sendViaMailgun(cfg, to, finalSubject, finalBody); break
          case 'telegram':
            await sendViaTelegram(cfg, to, finalSubject, finalBody); break
          case 'whatsapp':
            await sendViaWhatsApp(cfg, to, finalSubject, finalBody); break
          default:
            return NextResponse.json({ error: `Unsupported channel: ${connector_id}` }, { status: 400 })
        }
      } catch (dispatchErr) {
        status = 'failed'
        errorMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr)
      }

      // Log (comm_logs uses channel + recipient)
      const CHANNEL_MAP2: Record<string, string> = {
        smtp: 'email', outlook: 'email', sendgrid: 'email', mailgun: 'email', gmail: 'email',
        telegram: 'telegram', whatsapp: 'whatsapp',
      }
      try {
        await pool.query(
          `INSERT INTO communication_logs
             (user_id, channel, recipient, subject, body_preview, status, error_message, sent_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $6='sent' THEN NOW() ELSE NULL END)`,
          [userId, CHANNEL_MAP2[connector_id] ?? 'custom', to,
           finalSubject, finalBody.substring(0, 500), status, errorMsg]
        )
      } catch (logErr) {
        console.warn('[comms] Log write failed:', logErr instanceof Error ? logErr.message : logErr)
      }

      if (status === 'failed') {
        return NextResponse.json({ error: errorMsg }, { status: 502 })
      }
      return NextResponse.json({ status: 'sent' })
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
    // logs (default)
    const { rows } = await pool.query(
      `SELECT id, channel, recipient AS to_address, subject, status, error_message, created_at
       FROM communication_logs WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    )
    return NextResponse.json({ logs: rows })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
