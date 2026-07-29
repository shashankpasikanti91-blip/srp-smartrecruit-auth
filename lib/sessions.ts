/**
 * User session lifecycle — populates existing user_sessions table.
 */
import { pool } from './db'
import { createHash, randomBytes } from 'crypto'

export function parseUserAgent(ua?: string | null): {
  browser: string
  os: string
  deviceType: string
  deviceName: string
} {
  const s = ua || ''
  let browser = 'Unknown'
  if (/Edg\//i.test(s)) browser = 'Edge'
  else if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) browser = 'Chrome'
  else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = 'Safari'
  else if (/Firefox\//i.test(s)) browser = 'Firefox'

  let os = 'Unknown'
  if (/Windows/i.test(s)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS'
  else if (/Android/i.test(s)) os = 'Android'
  else if (/iPhone|iPad/i.test(s)) os = 'iOS'
  else if (/Linux/i.test(s)) os = 'Linux'

  const deviceType = /Mobile|Android|iPhone|iPad/i.test(s) ? 'mobile' : 'desktop'
  const deviceName = `${browser} on ${os}`
  return { browser, os, deviceType, deviceName }
}

function makeSessionToken(userId: string): string {
  return createHash('sha256')
    .update(`${userId}:${Date.now()}:${randomBytes(16).toString('hex')}`)
    .digest('hex')
    .slice(0, 64)
}

export async function createUserSession(opts: {
  userId: string
  tenantId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<string | null> {
  try {
    const parsed = parseUserAgent(opts.userAgent)
    const token = makeSessionToken(opts.userId)
    // Store device metadata in user_agent prefix for display without schema change
    const uaMeta = JSON.stringify({
      raw: opts.userAgent ?? null,
      browser: parsed.browser,
      os: parsed.os,
      device_type: parsed.deviceType,
      device_name: parsed.deviceName,
    })
    await pool.query(
      `INSERT INTO user_sessions
         (tenant_id, user_id, session_token, ip_address, user_agent, device_type, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
      [
        opts.tenantId ?? null,
        opts.userId,
        token,
        opts.ipAddress ?? null,
        uaMeta,
        parsed.deviceType,
      ]
    )
    return token
  } catch (err) {
    console.warn('[createUserSession]', err instanceof Error ? err.message : err)
    return null
  }
}

export async function touchUserSession(sessionToken: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE user_sessions SET last_activity = NOW()
       WHERE session_token = $1 AND is_active = TRUE`,
      [sessionToken]
    )
  } catch { /* ignore */ }
}

export async function listUserSessions(userId: string) {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, session_token, ip_address, user_agent, device_type,
            started_at, last_activity, ended_at, is_active
     FROM user_sessions
     WHERE user_id = $1
     ORDER BY is_active DESC, last_activity DESC
     LIMIT 50`,
    [userId]
  )
  return rows.map(r => {
    let meta: Record<string, string> = {}
    try {
      meta = typeof r.user_agent === 'string' && r.user_agent.startsWith('{')
        ? JSON.parse(r.user_agent)
        : { raw: r.user_agent }
    } catch {
      meta = { raw: r.user_agent }
    }
    return {
      id: r.id,
      session_token: r.session_token,
      ip_address: r.ip_address,
      browser: meta.browser || 'Unknown',
      os: meta.os || 'Unknown',
      device_name: meta.device_name || meta.raw || 'Unknown device',
      device_type: r.device_type || meta.device_type || 'desktop',
      started_at: r.started_at,
      last_activity: r.last_activity,
      ended_at: r.ended_at,
      is_active: r.is_active,
    }
  })
}

export async function terminateSession(opts: {
  userId: string
  sessionId: string
}): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE user_sessions
     SET is_active = FALSE, ended_at = NOW()
     WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
    [opts.sessionId, opts.userId]
  )
  return (rowCount ?? 0) > 0
}

export async function terminateOtherSessions(opts: {
  userId: string
  keepSessionId?: string | null
  keepToken?: string | null
}): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE user_sessions
     SET is_active = FALSE, ended_at = NOW()
     WHERE user_id = $1 AND is_active = TRUE
       AND ($2::uuid IS NULL OR id <> $2)
       AND ($3::text IS NULL OR session_token IS DISTINCT FROM $3)`,
    [opts.userId, opts.keepSessionId ?? null, opts.keepToken ?? null]
  )
  return rowCount ?? 0
}

export async function endSessionByToken(token: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE user_sessions SET is_active = FALSE, ended_at = NOW()
       WHERE session_token = $1 AND is_active = TRUE`,
      [token]
    )
  } catch { /* ignore */ }
}
