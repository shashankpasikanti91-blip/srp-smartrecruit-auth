/**
 * lib/calendar.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Calendar and Outlook Calendar OAuth + event management.
 *
 * GOOGLE CALENDAR
 *   Scopes: https://www.googleapis.com/auth/calendar.events
 *   Event creation: POST /calendar/v3/calendars/primary/events
 *   With conferenceData for Google Meet link (requiresNewConferenceData + requestId)
 *
 * OUTLOOK CALENDAR (Microsoft Graph)
 *   Scopes: Calendars.ReadWrite, OnlineMeetings.ReadWrite, offline_access
 *   Event creation: POST /v1.0/me/events
 *   With isOnlineMeeting: true for Teams meeting link
 *
 * All tokens stored encrypted in calendar_connections table.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto'
import { pool } from '@/lib/db'

const ENC_KEY = process.env.PORTAL_CREDENTIAL_KEY
  ? Buffer.from(process.env.PORTAL_CREDENTIAL_KEY, 'hex')
  : null

function encrypt(plain: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(enc: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return enc
  try {
    const buf = Buffer.from(enc, 'base64')
    const iv  = buf.slice(0, 12)
    const tag = buf.slice(12, 28)
    const dat = buf.slice(28)
    const d   = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    d.setAuthTag(tag)
    return d.update(dat) + d.final('utf8')
  } catch { return enc }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEventInput {
  summary:      string         // interview title
  description?: string
  start:        Date
  end:          Date
  attendees:    string[]       // email addresses
  timeZone?:    string         // default 'Asia/Kolkata'
  location?:    string
}

export interface CalendarEventResult {
  calendar_event_id: string
  meet_link:         string | null
  html_link:         string | null
  provider:          'google' | 'outlook'
}

export interface CalendarConnection {
  id:           string
  provider:     'google' | 'outlook'
  email:        string
  display_name: string | null
  is_active:    boolean
}

// ── OAuth URL builders ────────────────────────────────────────────────────────

export function googleCalendarAuthUrl(userId: string, tenantId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
    access_type:  'offline',
    prompt:       'consent',
    state:        Buffer.from(JSON.stringify({ userId, tenantId, provider: 'google' })).toString('base64'),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function outlookCalendarAuthUrl(userId: string, tenantId: string, redirectUri: string): string {
  const tenantSlug = process.env.MICROSOFT_TENANT_ID ?? 'common'
  const params = new URLSearchParams({
    client_id:     process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access',
    response_mode: 'query',
    state:         Buffer.from(JSON.stringify({ userId, tenantId, provider: 'outlook' })).toString('base64'),
  })
  return `https://login.microsoftonline.com/${tenantSlug}/oauth2/v2.0/authorize?${params}`
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeGoogleCalToken(
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
  if (!res.ok) throw new Error(`Google Calendar token exchange failed: ${await res.text()}`)
  const tokens = await res.json() as { access_token: string; refresh_token: string }

  const meRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = await meRes.json() as { email?: string; name?: string }

  return { ...tokens, email: me.email ?? '', name: me.name ?? '' }
}

export async function exchangeOutlookCalToken(
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
      scope:         'openid email profile Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access',
    }),
  })
  if (!res.ok) throw new Error(`Outlook Calendar token exchange failed: ${await res.text()}`)
  const tokens = await res.json() as { access_token: string; refresh_token: string }

  const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,displayName', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = await meRes.json() as { mail?: string; displayName?: string }

  return { ...tokens, email: me.mail ?? '', name: me.displayName ?? '' }
}

// ── Save calendar connection ──────────────────────────────────────────────────

export async function saveCalendarConnection(
  tenantId: string,
  userId: string,
  provider: 'google' | 'outlook',
  accessToken: string,
  refreshToken: string,
  email: string,
  displayName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO calendar_connections
       (tenant_id, user_id, provider, email_address, display_name,
        access_token_enc, refresh_token_enc, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
     ON CONFLICT (tenant_id, user_id, provider) DO UPDATE SET
       email_address     = EXCLUDED.email_address,
       display_name      = EXCLUDED.display_name,
       access_token_enc  = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       is_active         = TRUE,
       updated_at        = NOW()`,
    [tenantId, userId, provider, email, displayName, encrypt(accessToken), encrypt(refreshToken)]
  )
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<string> {
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
  if (!res.ok) throw new Error(`Google token refresh: ${await res.text()}`)
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
      scope:         'Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access',
    }),
  })
  if (!res.ok) throw new Error(`Outlook token refresh: ${await res.text()}`)
  const { access_token } = await res.json() as { access_token: string }
  return access_token
}

// ── Create event via Google Calendar ─────────────────────────────────────────

async function createGoogleEvent(
  accessToken: string,
  event: CalendarEventInput
): Promise<CalendarEventResult> {
  const tz  = event.timeZone ?? 'Asia/Kolkata'
  const reqId = crypto.randomUUID()

  const body = {
    summary:     event.summary,
    description: event.description ?? '',
    location:    event.location,
    start:  { dateTime: event.start.toISOString(), timeZone: tz },
    end:    { dateTime: event.end.toISOString(),   timeZone: tz },
    attendees: event.attendees.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId:             reqId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides:  [
        { method: 'email',  minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errData = await res.json() as { error?: { message?: string } }
    throw new Error(`Google Calendar event creation failed: ${errData.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as {
    id: string; htmlLink?: string
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> }
  }

  const meetLink = data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null

  return {
    calendar_event_id: data.id,
    meet_link:         meetLink,
    html_link:         data.htmlLink ?? null,
    provider:          'google',
  }
}

// ── Create event via Outlook / Graph API ──────────────────────────────────────

async function createOutlookEvent(
  accessToken: string,
  event: CalendarEventInput
): Promise<CalendarEventResult> {
  const tz = event.timeZone ?? 'Asia/Kolkata'

  const body = {
    subject:       event.summary,
    body:          { contentType: 'HTML', content: event.description ?? '' },
    start:         { dateTime: event.start.toISOString(), timeZone: tz },
    end:           { dateTime: event.end.toISOString(),   timeZone: tz },
    location:      event.location ? { displayName: event.location } : undefined,
    attendees:     event.attendees.map(addr => ({
      emailAddress: { address: addr },
      type:         'required',
    })),
    isOnlineMeeting:         true,
    onlineMeetingProvider:   'teamsForBusiness',
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errData = await res.json() as { error?: { message?: string } }
    throw new Error(`Outlook Calendar event failed: ${errData.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as { id: string; webLink?: string; onlineMeeting?: { joinUrl: string } }

  return {
    calendar_event_id: data.id,
    meet_link:         data.onlineMeeting?.joinUrl ?? null,
    html_link:         data.webLink ?? null,
    provider:          'outlook',
  }
}

// ── Update / Delete event ─────────────────────────────────────────────────────

export async function deleteCalendarEvent(
  tenantId: string,
  userId: string,
  provider: 'google' | 'outlook',
  eventId: string
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT access_token_enc, refresh_token_enc FROM calendar_connections
     WHERE tenant_id=$1 AND user_id=$2 AND provider=$3 AND is_active=TRUE`,
    [tenantId, userId, provider]
  )
  if (!rows.length) return

  let access = decrypt(rows[0].access_token_enc)

  const doDelete = async (tok: string) => {
    if (provider === 'google') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
    } else {
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
    }
  }

  try {
    await doDelete(access)
  } catch {
    const refresh = decrypt(rows[0].refresh_token_enc)
    access = provider === 'google'
      ? await refreshGoogleToken(refresh)
      : await refreshOutlookToken(refresh)
    await doDelete(access)
  }
}

// ── Main: create calendar event with auto-refresh ─────────────────────────────

export async function createInterviewEvent(
  tenantId: string,
  userId: string,
  event: CalendarEventInput
): Promise<CalendarEventResult> {
  const { rows } = await pool.query(
    `SELECT provider, access_token_enc, refresh_token_enc
     FROM calendar_connections
     WHERE tenant_id=$1 AND user_id=$2 AND is_active=TRUE
     ORDER BY updated_at DESC LIMIT 1`,
    [tenantId, userId]
  )

  if (!rows.length) {
    throw new Error('No calendar connected. Connect Google Calendar or Outlook in Settings → Calendar.')
  }

  const { provider, access_token_enc, refresh_token_enc } = rows[0]
  let access  = decrypt(access_token_enc)
  const refresh = decrypt(refresh_token_enc)

  const attemptCreate = async (tok: string): Promise<CalendarEventResult> => {
    if (provider === 'google') return createGoogleEvent(tok, event)
    return createOutlookEvent(tok, event)
  }

  try {
    return await attemptCreate(access)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid_grant')) {
      access = provider === 'google'
        ? await refreshGoogleToken(refresh)
        : await refreshOutlookToken(refresh)
      await pool.query(
        `UPDATE calendar_connections SET access_token_enc=$1, updated_at=NOW()
         WHERE tenant_id=$2 AND user_id=$3 AND provider=$4`,
        [encrypt(access), tenantId, userId, provider]
      )
      return attemptCreate(access)
    }
    throw err
  }
}

// ── List connections ──────────────────────────────────────────────────────────

export async function getCalendarConnections(
  tenantId: string,
  userId: string
): Promise<CalendarConnection[]> {
  const { rows } = await pool.query(
    `SELECT id, provider, email_address AS email, display_name, is_active
     FROM calendar_connections
     WHERE tenant_id=$1 AND user_id=$2
     ORDER BY updated_at DESC`,
    [tenantId, userId]
  )
  return rows
}

export async function disconnectCalendar(
  tenantId: string,
  userId: string,
  provider: string
): Promise<void> {
  await pool.query(
    `UPDATE calendar_connections SET is_active=FALSE, updated_at=NOW()
     WHERE tenant_id=$1 AND user_id=$2 AND provider=$3`,
    [tenantId, userId, provider]
  )
}
