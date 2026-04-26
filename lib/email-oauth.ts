/**
 * lib/email-oauth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gmail and Outlook (Microsoft) OAuth helper.
 *
 * GMAIL
 *   OAuth2 flow with scopes: gmail.send, gmail.readonly
 *   After auth: sends via Gmail API POST /gmail/v1/users/me/messages/send
 *
 * OUTLOOK / Microsoft 365
 *   OAuth2 via MSAL / Microsoft identity platform
 *   Scopes: Mail.Send, Mail.ReadBasic, offline_access
 *   After auth: sends via Graph API POST /v1.0/me/sendMail
 *
 * SMTP FALLBACK
 *   Used when no OAuth connection is stored.  Reads SMTP_* env vars.
 *
 * All tokens are stored encrypted in email_connections table.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto'
import { pool } from '@/lib/db'

// ── Encryption (shared with portal creds) ─────────────────────────────────────
const ENC_KEY = process.env.PORTAL_CREDENTIAL_KEY
  ? Buffer.from(process.env.PORTAL_CREDENTIAL_KEY, 'hex')
  : null

function encrypt(plain: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return plain
  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(enc: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return enc
  try {
    const buf    = Buffer.from(enc, 'base64')
    const iv     = buf.slice(0, 12)
    const tag    = buf.slice(12, 28)
    const data   = buf.slice(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch { return enc }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  to:       string | string[]
  cc?:      string | string[]
  subject:  string
  html:     string
  text?:    string
  replyTo?: string
}

export interface EmailConnection {
  id:            string
  provider:      'gmail' | 'outlook' | 'smtp'
  email_address: string
  display_name:  string | null
  is_active:     boolean
}

// ── OAuth URL builders ────────────────────────────────────────────────────────

export function gmailAuthUrl(userId: string, tenantId: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    access_type:   'offline',
    prompt:        'consent',  // force refresh_token
    state:         Buffer.from(JSON.stringify({ userId, tenantId, provider: 'gmail' })).toString('base64'),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function outlookAuthUrl(userId: string, tenantId: string, redirectUri: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID!
  const tenantSlug = process.env.MICROSOFT_TENANT_ID ?? 'common'
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile Mail.Send Mail.ReadBasic offline_access',
    response_mode: 'query',
    state:         Buffer.from(JSON.stringify({ userId, tenantId, provider: 'outlook' })).toString('base64'),
  })
  return `https://login.microsoftonline.com/${tenantSlug}/oauth2/v2.0/authorize?${params}`
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeGmailCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; email: string; name: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token exchange failed: ${await res.text()}`)
  const tokens = await res.json() as { access_token: string; refresh_token: string }

  // Fetch user email from userinfo
  const meRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = await meRes.json() as { email?: string; name?: string }

  return { ...tokens, email: me.email ?? '', name: me.name ?? '' }
}

export async function exchangeOutlookCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; email: string; name: string }> {
  const tenantSlug = process.env.MICROSOFT_TENANT_ID ?? 'common'
  const res = await fetch(`https://login.microsoftonline.com/${tenantSlug}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
      scope:         'openid email profile Mail.Send Mail.ReadBasic offline_access',
    }),
  })
  if (!res.ok) throw new Error(`Outlook token exchange failed: ${await res.text()}`)
  const tokens = await res.json() as { access_token: string; refresh_token: string }

  const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,displayName', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = await meRes.json() as { mail?: string; displayName?: string }

  return { ...tokens, email: me.mail ?? '', name: me.displayName ?? '' }
}

// ── Save connection to DB ─────────────────────────────────────────────────────

export async function saveEmailConnection(
  tenantId: string,
  userId: string,
  provider: 'gmail' | 'outlook',
  accessToken: string,
  refreshToken: string,
  emailAddress: string,
  displayName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO email_connections
       (tenant_id, user_id, provider, email_address, display_name,
        access_token_enc, refresh_token_enc, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
     ON CONFLICT (tenant_id, user_id, provider) DO UPDATE SET
       email_address      = EXCLUDED.email_address,
       display_name       = EXCLUDED.display_name,
       access_token_enc   = EXCLUDED.access_token_enc,
       refresh_token_enc  = EXCLUDED.refresh_token_enc,
       is_active          = TRUE,
       updated_at         = NOW()`,
    [
      tenantId,
      userId,
      provider,
      emailAddress,
      displayName,
      encrypt(accessToken),
      encrypt(refreshToken),
    ]
  )
}

// ── Refresh access token ──────────────────────────────────────────────────────

async function refreshGmailToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`)
  const { access_token } = await res.json() as { access_token: string }
  return access_token
}

async function refreshOutlookToken(refreshToken: string): Promise<string> {
  const tenantSlug = process.env.MICROSOFT_TENANT_ID ?? 'common'
  const res = await fetch(`https://login.microsoftonline.com/${tenantSlug}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type:    'refresh_token',
      scope:         'Mail.Send Mail.ReadBasic offline_access',
    }),
  })
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${await res.text()}`)
  const { access_token } = await res.json() as { access_token: string }
  return access_token
}

// ── Sending ───────────────────────────────────────────────────────────────────

async function sendViaGmail(
  accessToken: string,
  from: string,
  msg: EmailMessage
): Promise<void> {
  const toArr  = Array.isArray(msg.to) ? msg.to : [msg.to]
  const ccArr  = msg.cc ? (Array.isArray(msg.cc) ? msg.cc : [msg.cc]) : []

  // Build RFC-2822 email
  const headers = [
    `From: ${from}`,
    `To: ${toArr.join(', ')}`,
    ccArr.length ? `Cc: ${ccArr.join(', ')}` : null,
    msg.replyTo ? `Reply-To: ${msg.replyTo}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(msg.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(msg.html, 'utf8').toString('base64'),
  ].filter(Boolean).join('\r\n')

  const raw = Buffer.from(headers).toString('base64url')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const errBody = await res.json() as { error?: { message?: string } }
    throw new Error(`Gmail send failed: ${errBody.error?.message ?? res.statusText}`)
  }
}

async function sendViaOutlook(
  accessToken: string,
  msg: EmailMessage
): Promise<void> {
  const toArr = Array.isArray(msg.to) ? msg.to : [msg.to]
  const ccArr = msg.cc ? (Array.isArray(msg.cc) ? msg.cc : [msg.cc]) : []

  const body = {
    message: {
      subject: msg.subject,
      body: { contentType: 'HTML', content: msg.html },
      toRecipients: toArr.map(a => ({ emailAddress: { address: a } })),
      ccRecipients: ccArr.map(a => ({ emailAddress: { address: a } })),
      replyTo: msg.replyTo ? [{ emailAddress: { address: msg.replyTo } }] : undefined,
    },
    saveToSentItems: true,
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json() as { error?: { message?: string } }
    throw new Error(`Outlook send failed: ${errBody.error?.message ?? res.statusText}`)
  }
}

// ── Primary send function ─────────────────────────────────────────────────────
// Tries the tenant's active OAuth connection (gmail/outlook) first,
// refreshes token if needed, then falls back to SMTP.

export async function sendEmailFromTenant(
  tenantId: string,
  userId: string,
  msg: EmailMessage
): Promise<{ sent_via: string; from: string }> {
  // Look for active email connection for this user
  const { rows } = await pool.query(
    `SELECT id, provider, email_address, display_name,
            access_token_enc, refresh_token_enc
     FROM email_connections
     WHERE tenant_id = $1 AND user_id = $2 AND is_active = TRUE
     ORDER BY updated_at DESC LIMIT 1`,
    [tenantId, userId]
  )

  if (rows.length) {
    const conn = rows[0]
    let access = decrypt(conn.access_token_enc)
    const refresh = decrypt(conn.refresh_token_enc)
    const prov  = conn.provider as 'gmail' | 'outlook'
    const from  = conn.display_name
      ? `"${conn.display_name}" <${conn.email_address}>`
      : conn.email_address

    try {
      if (prov === 'gmail') {
        await sendViaGmail(access, from, msg)
      } else {
        await sendViaOutlook(access, msg)
      }
      return { sent_via: prov, from: conn.email_address }
    } catch (err: unknown) {
      const msg2 = err instanceof Error ? err.message : String(err)
      // Token likely expired — refresh and retry once
      if (msg2.includes('401') || msg2.includes('invalid_grant') || msg2.includes('Unauthorized')) {
        try {
          if (prov === 'gmail') {
            access = await refreshGmailToken(refresh)
          } else {
            access = await refreshOutlookToken(refresh)
          }
          // Save refreshed token
          await pool.query(
            `UPDATE email_connections SET access_token_enc = $1, updated_at = NOW()
             WHERE tenant_id = $2 AND user_id = $3 AND provider = $4`,
            [encrypt(access), tenantId, userId, prov]
          )
          if (prov === 'gmail') {
            await sendViaGmail(access, from, msg)
          } else {
            await sendViaOutlook(access, msg)
          }
          return { sent_via: prov, from: conn.email_address }
        } catch (refreshErr) {
          console.error(`[email] Token refresh failed for ${prov}:`, refreshErr)
          // Fall through to SMTP
        }
      } else {
        throw err // Real error, not token expiry
      }
    }
  }

  // SMTP fallback
  const smtpUser = process.env.SMTP_USER ?? ''
  const smtpPass = process.env.SMTP_PASS ?? ''
  if (!smtpUser || !smtpPass) {
    throw new Error('No email connection configured. Connect Gmail or Outlook in Settings → Email, or set SMTP_USER/SMTP_PASS env vars.')
  }

  const nodemailer = await import('nodemailer')
  const transport  = nodemailer.default.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT ?? '587'),
    secure: parseInt(process.env.SMTP_PORT ?? '587') === 465,
    auth:   { user: smtpUser, pass: smtpPass },
    tls:    { rejectUnauthorized: false },
  })

  const toStr = Array.isArray(msg.to) ? msg.to.join(', ') : msg.to
  await transport.sendMail({
    from:    `"SmartRecruit" <${smtpUser}>`,
    to:      toStr,
    cc:      msg.cc ? (Array.isArray(msg.cc) ? msg.cc.join(', ') : msg.cc) : undefined,
    replyTo: msg.replyTo,
    subject: msg.subject,
    html:    msg.html,
    text:    msg.text,
  })

  return { sent_via: 'smtp', from: smtpUser }
}

// ── List connections for a tenant/user ────────────────────────────────────────

export async function getEmailConnections(tenantId: string, userId: string): Promise<EmailConnection[]> {
  const { rows } = await pool.query(
    `SELECT id, provider, email_address, display_name, is_active
     FROM email_connections
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY updated_at DESC`,
    [tenantId, userId]
  )
  return rows
}

export async function disconnectEmailProvider(
  tenantId: string,
  userId: string,
  provider: string
): Promise<void> {
  await pool.query(
    `UPDATE email_connections SET is_active = FALSE, updated_at = NOW()
     WHERE tenant_id = $1 AND user_id = $2 AND provider = $3`,
    [tenantId, userId, provider]
  )
}
