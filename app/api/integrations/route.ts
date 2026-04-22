import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export const maxDuration = 30

// Static catalogue — 15 connectors, honest about availability
const CONNECTOR_CATALOGUE = [
  {
    id: 'naukri', name: 'Naukri', category: 'job_portal',
    description: 'Import candidate profiles from Naukri.com using manual CSV export',
    mode: 'manual', icon: '🔍',
    fields: [{ name: 'export_path', label: 'Naukri CSV export (upload via Import tab)', type: 'info' }],
  },
  {
    id: 'indeed', name: 'Indeed', category: 'job_portal',
    description: 'Import candidates from Indeed via resume export or API key',
    mode: 'manual', icon: '🔍',
    fields: [{ name: 'api_key', label: 'Indeed Publisher API Key', type: 'password' }],
  },
  {
    id: 'monster', name: 'Monster', category: 'job_portal',
    description: 'Monster job portal — use CSV export from Monster dashboard',
    mode: 'manual', icon: '👾',
    fields: [{ name: 'export_path', label: 'Monster CSV export (upload via Import tab)', type: 'info' }],
  },
  {
    id: 'linkedin', name: 'LinkedIn', category: 'job_portal',
    description: 'LinkedIn Recruiter export — use manual CSV from Recruiter Lite',
    mode: 'manual', icon: '💼',
    fields: [{ name: 'note', label: 'LinkedIn API requires enterprise license. Use CSV export.', type: 'info' }],
  },
  {
    id: 'shine', name: 'Shine.com', category: 'job_portal',
    description: 'Shine.com candidate CSV import', mode: 'manual', icon: '✨',
    fields: [{ name: 'export_path', label: 'Shine CSV export (upload via Import tab)', type: 'info' }],
  },
  {
    id: 'smtp', name: 'SMTP Email', category: 'email',
    description: 'Send emails via your SMTP server (Gmail, Zoho, corporate SMTP)',
    mode: 'live', icon: '📧',
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
    description: 'SendGrid transactional email — reliable bulk email delivery',
    mode: 'live', icon: '📨',
    fields: [
      { name: 'api_key', label: 'SendGrid API Key', type: 'password' },
      { name: 'from_email', label: 'Verified From Email', type: 'text' },
      { name: 'from_name', label: 'From Name', type: 'text' },
    ],
  },
  {
    id: 'mailgun', name: 'Mailgun', category: 'email',
    description: 'Mailgun transactional email API',
    mode: 'live', icon: '🔫',
    fields: [
      { name: 'api_key', label: 'Mailgun API Key', type: 'password' },
      { name: 'domain', label: 'Mailgun Domain', type: 'text' },
      { name: 'from_email', label: 'From Email', type: 'text' },
    ],
  },
  {
    id: 'telegram', name: 'Telegram Bot', category: 'messaging',
    description: 'Send automated Telegram messages via Bot API',
    mode: 'live', icon: '✈️',
    fields: [
      { name: 'bot_token', label: 'Bot Token', type: 'password' },
      { name: 'default_chat_id', label: 'Default Chat ID (optional)', type: 'text' },
    ],
  },
  {
    id: 'whatsapp', name: 'WhatsApp (Twilio)', category: 'messaging',
    description: 'Send WhatsApp messages via Twilio Business API',
    mode: 'live', icon: '💬',
    fields: [
      { name: 'account_sid', label: 'Twilio Account SID', type: 'text' },
      { name: 'auth_token', label: 'Twilio Auth Token', type: 'password' },
      { name: 'whatsapp_number', label: 'WhatsApp Number (e.g. whatsapp:+14155238886)', type: 'text' },
    ],
  },
  {
    id: 'n8n', name: 'n8n', category: 'automation',
    description: 'Trigger n8n workflows on recruitment events (candidate created, screened, hired)',
    mode: 'live', icon: '⚡',
    fields: [
      { name: 'webhook_url', label: 'n8n Webhook URL', type: 'text' },
      { name: 'webhook_secret', label: 'Webhook Secret (optional)', type: 'password' },
    ],
  },
  {
    id: 'make', name: 'Make (Integromat)', category: 'automation',
    description: 'Trigger Make scenarios on recruitment events',
    mode: 'live', icon: '🔧',
    fields: [
      { name: 'webhook_url', label: 'Make Webhook URL', type: 'text' },
    ],
  },
  {
    id: 'zapier', name: 'Zapier', category: 'automation',
    description: 'Trigger Zapier Zaps on recruitment events via webhook',
    mode: 'live', icon: '⚡',
    fields: [
      { name: 'webhook_url', label: 'Zapier Catch Hook URL', type: 'text' },
    ],
  },
  {
    id: 'google_drive', name: 'Google Drive', category: 'storage',
    description: 'Auto-upload parsed resumes and JDs to Google Drive folder',
    mode: 'coming_soon', icon: '📁',
    fields: [],
  },
  {
    id: 'outlook', name: 'Outlook', category: 'email',
    description: 'Microsoft Outlook / Office 365 SMTP integration',
    mode: 'live', icon: '📮',
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

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const { rows } = await pool.query(
      `SELECT id, slug AS connector_id, name, category, status,
              (status = 'active') AS is_active, config, created_at, updated_at
       FROM integrations WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    const result = rows.map(r => ({
      ...r,
      config: maskCredentials((r.config as Record<string, string>) ?? {}),
    }))
    return NextResponse.json({ integrations: result })
  } catch {
    return NextResponse.json({ integrations: [] })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

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

      const statusVal = (is_active ?? true) ? 'active' : 'inactive'
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO integrations
           (user_id, slug, name, category, status, mode, config)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id, slug) DO UPDATE
           SET name = EXCLUDED.name, config = EXCLUDED.config,
               status = EXCLUDED.status, updated_at = NOW()
         RETURNING id`,
        [userId, connector_id, name ?? catalogueItem.name, catalogueItem.category,
         statusVal, catalogueItem.mode, JSON.stringify(config ?? {})]
      )
      return NextResponse.json({ id: rows[0]?.id, status: 'saved' })
    }

    if (action === 'toggle') {
      if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })
      const { rows } = await pool.query<{ status: string }>(
        `UPDATE integrations
         SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2 RETURNING status`,
        [integration_id, userId]
      )
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ status: rows[0].status, is_active: rows[0].status === 'active' })
    }

    if (action === 'delete') {
      if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })
      await pool.query(`DELETE FROM integrations WHERE id = $1 AND user_id = $2`, [integration_id, userId])
      return NextResponse.json({ status: 'deleted' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
