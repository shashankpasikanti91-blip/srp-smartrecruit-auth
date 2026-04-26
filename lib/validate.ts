/**
 * lib/validate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Input validation helpers used across all API routes.
 * All validation is strict — never trusts client input.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// UUID v4 regex — reject any forged IDs before they reach the DB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Email RFC 5321 practical regex (not exhaustive, catches common attacks)
const EMAIL_RE = /^[^\s@"';<>()\[\]\\,]{1,64}@[^\s@"';<>()\[\]\\,]{1,255}\.[a-z]{2,}$/i

// ── UUID ─────────────────────────────────────────────────────────────────────

/**
 * Returns true only if the value is a well-formed UUID v4.
 * Use before passing any user-supplied ID into a SQL query.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Validates a UUID and throws if invalid. Returns the validated string.
 * Use in API routes where a UUID is required.
 */
export function requireUUID(value: unknown, fieldName = 'id'): string {
  if (!isValidUUID(value)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid UUID`)
  }
  return value
}

// ── Email ─────────────────────────────────────────────────────────────────────

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value) && value.length <= 320
}

export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return isValidEmail(trimmed) ? trimmed : null
}

// ── Text / String ─────────────────────────────────────────────────────────────

/**
 * Trims and enforces a max length. Returns null if empty or not a string.
 */
export function sanitizeText(value: unknown, maxLen = 1000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

/**
 * Sanitize a required text field, throws if missing or empty.
 */
export function requireText(value: unknown, fieldName = 'field', maxLen = 1000): string {
  const s = sanitizeText(value, maxLen)
  if (!s) throw new ValidationError(`${fieldName} is required`)
  return s
}

// ── Integer ───────────────────────────────────────────────────────────────────

export function sanitizePositiveInt(value: unknown, max = 1000): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : null
  if (n === null || isNaN(n) || n < 0 || n > max) return null
  return Math.floor(n)
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

// ── Enum ──────────────────────────────────────────────────────────────────────

/**
 * Validates that a value is one of the allowed enum strings.
 * Returns the value, or the fallback (including null) if not valid.
 */
export function sanitizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null
): T | null {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return fallback
}

// ── Array ─────────────────────────────────────────────────────────────────────

/**
 * Returns a string array from a value, stripping non-string/empty items.
 */
export function sanitizeStringArray(value: unknown, maxItems = 100, maxItemLen = 200): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(v => typeof v === 'string' && v.trim().length > 0)
    .slice(0, maxItems)
    .map(v => (v as string).trim().slice(0, maxItemLen))
}

// ── Custom Error ──────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ── Helpers for route handlers ────────────────────────────────────────────────

/**
 * Safe JSON body parser — never throws to the caller.
 * Returns null if body is unparseable or not an object.
 */
export async function parseBodySafe(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text()
    if (!text.trim()) return null
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
