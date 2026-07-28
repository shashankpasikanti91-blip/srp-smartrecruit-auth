/**
 * Structured request logging + PII/secret redaction for GA observability.
 * Levels: INFO | WARN | ERROR | CRITICAL
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

const SENSITIVE_KEY =
  /^(password|passwd|pwd|token|access_token|refresh_token|id_token|authorization|cookie|set-cookie|api[_-]?key|secret|smtp_pass|private[_-]?key|credit[_-]?card|ssn|nric|aadhaar|resume[_-]?text|resumeText|cv[_-]?text)$/i

const SENSITIVE_QUERY = /([?&](?:token|password|code|secret|key)=)[^&]*/gi

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function redactValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') {
    if (value.length > 500) return `[redacted:${value.length}chars]`
    return value
  }
  if (Array.isArray(value)) return value.map(redactValue)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redactValue(v)
    }
    return out
  }
  return value
}

export function redactUrl(url: string): string {
  return url.replace(SENSITIVE_QUERY, '$1[REDACTED]')
}

export function parseUserAgent(ua: string | null | undefined): {
  browser: string
  device: string
} {
  const s = ua ?? ''
  let browser = 'unknown'
  if (/Edg\//i.test(s)) browser = 'Edge'
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome'
  else if (/Firefox\//i.test(s)) browser = 'Firefox'
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari'
  else if (/MSIE|Trident/i.test(s)) browser = 'IE'

  let device = 'desktop'
  if (/iPad|Tablet/i.test(s)) device = 'tablet'
  else if (/Mobi|Android.*Mobile|iPhone/i.test(s)) device = 'mobile'

  return { browser, device }
}

export type RequestLogFields = {
  requestId: string
  level?: LogLevel
  method: string
  path: string
  status?: number
  durationMs?: number
  tenantId?: string | null
  userId?: string | null
  module?: string
  action?: string
  ip?: string | null
  browser?: string
  device?: string
  env?: string
  message?: string
  meta?: Record<string, unknown>
}

export function logRequest(fields: RequestLogFields): void {
  const level = fields.level ?? 'INFO'

  const line = {
    level,
    ts: new Date().toISOString(),
    requestId: fields.requestId,
    tenantId: fields.tenantId ?? null,
    userId: fields.userId ?? null,
    module: fields.module ?? null,
    action: fields.action ?? null,
    method: fields.method,
    path: redactUrl(fields.path),
    status: fields.status ?? null,
    durationMs: fields.durationMs ?? null,
    ip: fields.ip ?? null,
    browser: fields.browser ?? null,
    device: fields.device ?? null,
    env: fields.env ?? process.env.NODE_ENV ?? 'development',
    message: fields.message ?? null,
    meta: fields.meta ? (redactValue(fields.meta) as Record<string, unknown>) : undefined,
  }

  const serialized = JSON.stringify(line)
  if (level === 'CRITICAL' || level === 'ERROR') {
    console.error(serialized)
  } else if (level === 'WARN') {
    console.warn(serialized)
  } else {
    console.info(serialized)
  }
}

/** Prefer existing inbound request id; otherwise generate one. */
export function resolveRequestId(headerValue: string | null): string {
  const v = (headerValue ?? '').trim()
  if (v && v.length <= 128 && /^[A-Za-z0-9._-]+$/.test(v)) return v
  return generateRequestId()
}
