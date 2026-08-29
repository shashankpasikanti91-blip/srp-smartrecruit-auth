import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'

export const maxDuration = 30

/**
 * Static catalogue — honest availability + setup guides for non-technical users.
 * setup_steps / unlocks / docs_url drive the Integrations configure modal.
 */
const CONNECTOR_CATALOGUE = [
  {
    id: 'naukri', name: 'Naukri', category: 'job_portal',
    description: 'Connect Naukri.com to source and import candidate profiles. Use API credentials or bulk CSV export via the Import tab.',
    mode: 'live', icon: '🔍',
    docs_url: 'https://www.naukri.com/',
    unlocks: ['Store Naukri API credentials for this workspace', 'Import candidates via Import tab / CSV when API access is limited'],
    setup_steps: [
      'Ask your Naukri account manager or company admin for API / partner credentials (not available on every plan).',
      'Copy Client ID, Client Secret, and API Key from the Naukri partner console.',
      'Paste below → Save → Test Connection. Prefer CSV Import if your plan has no API.',
    ],
    fields: [
      { name: 'api_key', label: 'Naukri API Key', type: 'password', placeholder: 'Enter your Naukri API Key' },
      { name: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Naukri Client ID' },
      { name: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Naukri Client Secret' },
    ],
  },
  {
    id: 'indeed', name: 'Indeed', category: 'job_portal',
    description: 'Connect Indeed Publisher API to post jobs and import candidates directly from Indeed.',
    mode: 'live', icon: '🔍',
    docs_url: 'https://developer.indeed.com/',
    unlocks: ['Store Indeed Publisher credentials', 'Job posting / import when your Indeed publisher account is approved'],
    setup_steps: [
      'Create or open an Indeed Publisher / Employer account.',
      'In the Indeed developer / publisher portal, create an API key.',
      'Copy Publisher Account ID + API Key → Save → Test Connection.',
    ],
    fields: [
      { name: 'api_key', label: 'Indeed Publisher API Key', type: 'password', placeholder: 'Enter your Indeed Publisher API Key' },
      { name: 'publisher_id', label: 'Publisher Account ID', type: 'text', placeholder: 'Your Indeed Publisher ID' },
    ],
  },
  {
    id: 'monster', name: 'Monster', category: 'job_portal',
    description: 'Monster job portal — post jobs and retrieve candidate profiles via Monster API credentials.',
    mode: 'live', icon: '👾',
    unlocks: ['Store Monster API credentials for this workspace'],
    setup_steps: [
      'Request API access from your Monster account representative (enterprise / partner plans).',
      'Copy API Key and Publisher / Account ID from the Monster console.',
      'Paste below → Save → Test Connection.',
    ],
    fields: [
      { name: 'api_key', label: 'Monster API Key', type: 'password', placeholder: 'Enter your Monster API Key' },
      { name: 'publisher_id', label: 'Publisher / Account ID', type: 'text', placeholder: 'Monster Publisher ID' },
    ],
  },
  {
    id: 'linkedin', name: 'LinkedIn', category: 'job_portal',
    description: 'LinkedIn Recruiter — connect via OAuth app credentials to sync job postings and candidate profiles.',
    mode: 'live', icon: '💼',
    docs_url: 'https://www.linkedin.com/developers/',
    unlocks: ['Store LinkedIn app credentials', 'Job / profile sync when LinkedIn Partner Program access is approved'],
    setup_steps: [
      'Go to LinkedIn Developers → Create app (company admin usually required).',
      'Copy Client ID and Client Secret. Request the products your company is approved for.',
      'Optional: paste a long-lived access token if your security team issued one → Save → Test.',
    ],
    fields: [
      { name: 'client_id', label: 'LinkedIn App Client ID', type: 'text', placeholder: 'LinkedIn OAuth Client ID' },
      { name: 'client_secret', label: 'LinkedIn App Client Secret', type: 'password', placeholder: 'LinkedIn OAuth Client Secret' },
      { name: 'access_token', label: 'Access Token (Optional)', type: 'password', placeholder: 'Long-lived OAuth access token' },
    ],
  },
  {
    id: 'shine', name: 'Shine.com', category: 'job_portal',
    description: 'Shine.com job portal — connect via API credentials to source and import candidate data.',
    mode: 'live', icon: '✨',
    unlocks: ['Store Shine API credentials for this workspace'],
    setup_steps: [
      'Request API credentials from Shine enterprise support for your company account.',
      'Copy API Key and Account ID → Save → Test Connection.',
    ],
    fields: [
      { name: 'api_key', label: 'Shine API Key', type: 'password', placeholder: 'Enter your Shine API Key' },
      { name: 'account_id', label: 'Account ID', type: 'text', placeholder: 'Your Shine account ID' },
    ],
  },
  {
    id: 'smtp', name: 'SMTP Email', category: 'email',
    description: 'Send emails via your SMTP server (Gmail, Zoho, corporate SMTP). After Connected, use Communications → Send or AI Compose.',
    mode: 'live', icon: '📧',
    docs_url: 'https://support.google.com/accounts/answer/185833',
    unlocks: [
      'Send email from Communications → Send (enter candidate email)',
      'Send from AI Compose using this workspace SMTP',
      'Messages can be linked to Candidate / Job / Client',
    ],
    setup_steps: [
      'Gmail: Google Account → Security → 2-Step Verification → App passwords → create one for “Mail”. Use that as App Password (not your normal password).',
      'Corporate SMTP: ask IT for host (e.g. smtp.office365.com), port 587, username, and password or app password.',
      'Fill From Name + From Email → Save → Test Connection. Then open Communications to send.',
    ],
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { name: 'port', label: 'SMTP Port', type: 'text', placeholder: '587' },
      { name: 'username', label: 'Username / Email', type: 'text' },
      { name: 'password', label: 'App Password', type: 'password' },
      { name: 'from_name', label: 'From Name', type: 'text' },
      { name: 'from_email', label: 'From Email', type: 'text' },
    ],
  },
  {
    id: 'sendgrid', name: 'SendGrid', category: 'email',
    description: 'SendGrid transactional email — reliable bulk email delivery via Communications Send.',
    mode: 'live', icon: '📨',
    docs_url: 'https://app.sendgrid.com/settings/api_keys',
    unlocks: ['Send email via Communications using SendGrid', 'Verified From address for transactional mail'],
    setup_steps: [
      'Sign in at SendGrid → Settings → API Keys → Create API Key (Mail Send permission).',
      'Verify a Sender Identity / From email in SendGrid.',
      'Paste API Key + From Email → Save → Test Connection → send from Communications.',
    ],
    fields: [
      { name: 'api_key', label: 'SendGrid API Key', type: 'password' },
      { name: 'from_email', label: 'Verified From Email', type: 'text' },
      { name: 'from_name', label: 'From Name', type: 'text' },
    ],
  },
  {
    id: 'mailgun', name: 'Mailgun', category: 'email',
    description: 'Mailgun transactional email API for Communications Send.',
    mode: 'live', icon: '🔫',
    docs_url: 'https://app.mailgun.com/app/account/security/api_keys',
    unlocks: ['Send email via Communications using Mailgun'],
    setup_steps: [
      'Mailgun dashboard → Sending → Domains (verify your domain) → API Keys.',
      'Copy Private API Key + domain + From Email → Save → Test Connection.',
    ],
    fields: [
      { name: 'api_key', label: 'Mailgun API Key', type: 'password' },
      { name: 'domain', label: 'Mailgun Domain', type: 'text' },
      { name: 'from_email', label: 'From Email', type: 'text' },
    ],
  },
  {
    id: 'telegram', name: 'Telegram Bot', category: 'messaging',
    description: 'Send Telegram messages via Bot API from Communications → Send.',
    mode: 'live', icon: '✈️',
    docs_url: 'https://core.telegram.org/bots#how-do-i-create-a-bot',
    unlocks: ['Send Telegram messages from Communications (chat ID or default chat)'],
    setup_steps: [
      'Open Telegram → search @BotFather → /newbot → copy the bot token.',
      'Message your bot, then get chat ID (e.g. via @userinfobot or your ops script).',
      'Paste Bot Token (+ optional Default Chat ID) → Save → Test → send from Communications.',
    ],
    fields: [
      { name: 'bot_token', label: 'Bot Token', type: 'password' },
      { name: 'default_chat_id', label: 'Default Chat ID (optional)', type: 'text' },
    ],
  },
  {
    id: 'whatsapp', name: 'WhatsApp Business (Meta Cloud)', category: 'messaging',
    description: 'Official Meta WhatsApp Cloud API. After Connected, send to candidate phone numbers from Communications. Status stays Not Configured until Test succeeds.',
    mode: 'live', icon: '💬',
    docs_url: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    unlocks: [
      'Send WhatsApp from Communications → Send (recipient = phone number)',
      'Link messages to Candidate / Job / Client (timeline)',
      'Delivery / read / failed status via Meta webhook (/api/webhooks/whatsapp)',
      'Inbound replies appear in Communications WhatsApp inbox when webhook is live',
    ],
    setup_steps: [
      'Create a Meta Developer app → add WhatsApp product → link a WhatsApp Business Account (WABA).',
      'In WhatsApp → API Setup, copy Phone Number ID and a permanent / system-user Access Token (not the short-lived test token for production).',
      'Optional: copy WABA ID. Create a Verify Token (any strong random string) and paste it below — same token must be set in Meta webhook settings.',
      'Webhook Callback URL (ops): https://YOUR_DOMAIN/api/webhooks/whatsapp — subscribe to messages + message_deliveries. Set META_APP_SECRET (or App Secret field) for signature verification.',
      'Paste fields → Save → Test Connection. Meta may require approved message templates for outbound to users who have not messaged you recently.',
    ],
    fields: [
      { name: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Meta permanent or system-user token' },
      { name: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: 'WhatsApp Phone Number ID' },
      { name: 'waba_id', label: 'WhatsApp Business Account ID (optional)', type: 'text', placeholder: 'WABA ID' },
      { name: 'api_version', label: 'Graph API version', type: 'text', placeholder: 'v19.0' },
      { name: 'verify_token', label: 'Webhook Verify Token', type: 'password', placeholder: 'Same token you enter in Meta webhook settings' },
      { name: 'app_secret', label: 'Meta App Secret (optional if META_APP_SECRET env set)', type: 'password', placeholder: 'App secret for X-Hub-Signature-256' },
    ],
  },
  {
    id: 'whatsapp_twilio_legacy', name: 'WhatsApp (Twilio — legacy)', category: 'messaging',
    description: 'Legacy Twilio WhatsApp. Prefer Meta WhatsApp Business Cloud. Kept for tenants already on Twilio.',
    mode: 'live', icon: '💬',
    docs_url: 'https://console.twilio.com/',
    unlocks: ['Send WhatsApp via Twilio from Communications (legacy)'],
    setup_steps: [
      'Prefer the Meta WhatsApp connector unless you already use Twilio.',
      'Twilio Console → Account SID + Auth Token → WhatsApp-enabled sender number.',
      'Paste → Save → Test → send from Communications.',
    ],
    fields: [
      { name: 'account_sid', label: 'Twilio Account SID', type: 'text' },
      { name: 'auth_token', label: 'Twilio Auth Token', type: 'password' },
      { name: 'whatsapp_number', label: 'WhatsApp Number (e.g. whatsapp:+14155238886)', type: 'text' },
    ],
  },
  {
    id: 'sms', name: 'SMS', category: 'messaging',
    description: 'SMS provider integration — FUTURE. Requires approved provider account. Not available to connect yet.',
    mode: 'coming_soon', icon: '📱',
    unlocks: [],
    setup_steps: ['Coming soon — no credentials to enter yet.'],
    fields: [],
  },
  {
    id: 'linkedin_messaging', name: 'LinkedIn Messaging', category: 'messaging',
    description: 'LinkedIn messaging — FUTURE. Requires approved LinkedIn API access. Job portal credentials use the LinkedIn connector separately.',
    mode: 'coming_soon', icon: '💼',
    unlocks: [],
    setup_steps: ['Coming soon — use LinkedIn under Job portals for posting/sync credentials only.'],
    fields: [],
  },
  {
    id: 'n8n', name: 'n8n', category: 'automation',
    description: 'Trigger n8n workflows on recruitment events (candidate created, screened, hired)',
    mode: 'live', icon: '⚡',
    docs_url: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/',
    unlocks: ['Fire your n8n workflow when recruitment events occur in this workspace'],
    setup_steps: [
      'In n8n, add a Webhook node → copy the Production URL.',
      'Optional: set a shared secret header value.',
      'Paste Webhook URL → Save → Test Connection.',
    ],
    fields: [
      { name: 'webhook_url', label: 'n8n Webhook URL', type: 'text' },
      { name: 'webhook_secret', label: 'Webhook Secret (optional)', type: 'password' },
    ],
  },
  {
    id: 'make', name: 'Make (Integromat)', category: 'automation',
    description: 'Trigger Make scenarios on recruitment events',
    mode: 'live', icon: '🔧',
    unlocks: ['Trigger Make scenarios from this workspace'],
    setup_steps: [
      'In Make, create a Custom webhook → copy the webhook URL.',
      'Paste below → Save → Test Connection.',
    ],
    fields: [
      { name: 'webhook_url', label: 'Make Webhook URL', type: 'text' },
    ],
  },
  {
    id: 'zapier', name: 'Zapier', category: 'automation',
    description: 'Trigger Zapier Zaps on recruitment events via webhook',
    mode: 'live', icon: '⚡',
    unlocks: ['Trigger Zapier Zaps from this workspace'],
    setup_steps: [
      'In Zapier, create a Zap with “Webhooks by Zapier” Catch Hook → copy URL.',
      'Paste → Save → Test Connection.',
    ],
    fields: [
      { name: 'webhook_url', label: 'Zapier Catch Hook URL', type: 'text' },
    ],
  },
  {
    id: 'google_drive', name: 'Google Drive', category: 'storage',
    description: 'Auto-upload parsed resumes and JDs to Google Drive folder',
    mode: 'coming_soon', icon: '📁',
    unlocks: [],
    setup_steps: ['Coming soon.'],
    fields: [],
  },
  {
    id: 'outlook', name: 'Outlook', category: 'email',
    description: 'Microsoft Outlook / Office 365 SMTP. After Connected, send from Communications.',
    mode: 'live', icon: '📮',
    docs_url: 'https://support.microsoft.com/office',
    unlocks: [
      'Send email from Communications via Microsoft 365 SMTP',
      'Use with AI Compose after Test succeeds',
    ],
    setup_steps: [
      'Use smtp.office365.com, port 587. Username = your work email.',
      'If MFA is on, create an app password or ask IT to allow SMTP AUTH for your mailbox.',
      'Paste credentials → Save → Test → send from Communications (To = candidate email).',
    ],
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.office365.com' },
      { name: 'port', label: 'Port', type: 'text', placeholder: '587' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
      { name: 'from_email', label: 'From Email', type: 'text' },
    ],
  },
]

// Simple field-level masking (leaves last 4 chars of password fields)
function maskCredentials(config: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(config)) {
    if (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') ||
        k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') ||
        k.toLowerCase().includes('sid')) {
      masked[k] = v ? `••••${v.slice(-4)}` : ''
    } else {
      masked[k] = v
    }
  }
  return masked
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  // Catalogue is static — no auth required
  if (url.searchParams.get('catalogue') === 'true') {
    return NextResponse.json({ catalogue: CONNECTOR_CATALOGUE })
  }

  const ctx = await requireTenant(req, 'integrations.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { rows } = await pool.query(
      `SELECT id, slug AS connector_id, name, category, status,
              (status = 'active') AS is_active, config, created_at, updated_at
       FROM integrations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [ctx.tenantId]
    )
    const result = rows.map(r => {
      const cfg = (r.config as Record<string, string>) ?? {}
      const connection_status =
        (cfg.connection_status as string) ||
        (r.status === 'active' ? 'not_tested' : 'not_configured')
      // Honest Connected: only after successful Test Connection
      const connected = connection_status === 'connected'
      const { connection_status: _cs, last_tested_at, ...restCfg } = cfg
      return {
        ...r,
        is_active: Boolean(r.is_active),
        connection_status,
        last_tested_at: last_tested_at ?? null,
        connected,
        config: maskCredentials(restCfg as Record<string, string>),
      }
    })
    return NextResponse.json({ integrations: result })
  } catch {
    return NextResponse.json({ integrations: [] })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'integrations.update')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json() as Record<string, unknown>
    const { action, connector_id, name, config, is_active, integration_id } = body as {
      action: string
      connector_id?: string
      name?: string
      config?: Record<string, string>
      is_active?: boolean
      integration_id?: string
    }

    if (action === 'upsert') {
      if (!connector_id) return NextResponse.json({ error: 'connector_id required' }, { status: 400 })
      const catalogueItem = CONNECTOR_CATALOGUE.find(c => c.id === connector_id)
      if (!catalogueItem) return NextResponse.json({ error: 'Unknown connector' }, { status: 400 })
      if (catalogueItem.mode === 'coming_soon') {
        return NextResponse.json({ error: 'This connector is coming soon and not yet available' }, { status: 400 })
      }

      // Never mark connected until Test Connection succeeds — store as inactive/not_tested
      const statusVal = (is_active ?? false) ? 'active' : 'inactive'
      const connectionStatus = 'not_tested'
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO integrations
           (tenant_id, user_id, slug, name, category, status, mode, config)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id, slug) DO UPDATE
           SET name = EXCLUDED.name, config = EXCLUDED.config,
               status = EXCLUDED.status, updated_at = NOW()
         RETURNING id`,
        [ctx.tenantId, ctx.userId, connector_id, name ?? catalogueItem.name, catalogueItem.category,
         statusVal, catalogueItem.mode, JSON.stringify({ ...(config ?? {}), connection_status: connectionStatus })]
      )
      return NextResponse.json({
        id: rows[0]?.id,
        status: 'saved',
        connection_status: connectionStatus,
        note: 'Saved securely. Run Test Connection before treating as Connected.',
      })
    }

    if (action === 'toggle') {
      if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })
      const { rows } = await pool.query<{ status: string }>(
        `UPDATE integrations
         SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END,
             updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 RETURNING status`,
        [integration_id, ctx.tenantId]
      )
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ status: rows[0].status, is_active: rows[0].status === 'active' })
    }

    if (action === 'delete') {
      if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })
      await pool.query(`DELETE FROM integrations WHERE id = $1 AND tenant_id = $2`, [integration_id, ctx.tenantId])
      return NextResponse.json({ status: 'deleted' })
    }

    if (action === 'test') {
      // Thin alias — prefer POST /api/integrations/test
      return NextResponse.json({
        error: 'Use POST /api/integrations/test with { type, provider }',
      }, { status: 400 })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
