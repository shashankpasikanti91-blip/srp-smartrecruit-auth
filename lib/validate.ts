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

export function sanitizeExternalUrl(value: unknown, maxLen = 1000): string | null {
  const text = sanitizeText(value, maxLen)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
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

/** Recruiter-maintained fields (JSON on resumes). Values are trimmed / length-capped. */
export function sanitizeCandidateProfile(value: unknown): Record<string, string | null> {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return {}
  const src = value as Record<string, unknown>
  const pick = (k: string, max: number) => sanitizeText(src[k], max)

  // Malaysian NRIC — prefer `nric`, fall back to legacy Other-ID when type is NRIC/IC
  let nric = pick('nric', 20)
  if (!nric) {
    const idType = (pick('id_document_type', 80) ?? '').toLowerCase()
    if (/\bnric\b|\bic\b|identity card|mykad/.test(idType)) {
      nric = pick('id_document_reference', 20)
    }
  }
  if (nric) {
    const digits = nric.replace(/\D/g, '')
    if (digits.length === 12) {
      nric = `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
    }
  }

  // Alias salary_expectation ↔ expected_salary for older UI rows
  const expected =
    pick('expected_salary', 120) ?? pick('salary_expectation', 120)

  return {
    // Employment / role
    current_company: pick('current_company', 200) ?? pick('current_employer', 200),
    current_employer: pick('current_employer', 200) ?? pick('current_company', 200),
    current_title: pick('current_title', 200) ?? pick('current_role', 200),
    current_role: pick('current_role', 200) ?? pick('current_title', 200),
    current_location: pick('current_location', 200),
    preferred_location: pick('preferred_location', 200),
    address: pick('address', 500),
    // Experience
    total_experience: pick('total_experience', 40),
    relevant_experience: pick('relevant_experience', 40),
    // Compensation
    current_salary: pick('current_salary', 120),
    expected_salary: expected,
    salary_expectation: expected,
    notice_period: pick('notice_period', 80),
    // Identity / MY
    nationality: pick('nationality', 100),
    nric,
    dob: pick('dob', 20),
    gender: pick('gender', 20),
    marital_status: pick('marital_status', 40),
    passport_number: pick('passport_number', 40),
    // Visa / work auth
    work_authorization: pick('work_authorization', 200),
    visa_type: pick('visa_type', 120),
    visa_expiry: pick('visa_expiry', 40),
    // India IDs (kept for multi-market tenants)
    india_pan: pick('india_pan', 12),
    india_aadhaar_last4: pick('india_aadhaar_last4', 12),
    pf_number: pick('pf_number', 40),
    id_document_type: pick('id_document_type', 80),
    id_document_reference: pick('id_document_reference', 80),
    // Submission / commercial
    hire_type: pick('hire_type', 40),
    client_name: pick('client_name', 200),
    applying_for: pick('applying_for', 200),
    source_channel: pick('source_channel', 80),
    interview_mode: pick('interview_mode', 40),
    offers_in_hand: pick('offers_in_hand', 200),
    submission_date: pick('submission_date', 40),
    lifecycle_status: pick('lifecycle_status', 60),
    // Notes
    notes: pick('notes', 2000),
    follow_up_notes: pick('follow_up_notes', 2000),
    candidate_feedback: pick('candidate_feedback', 2000),
    internal_comments: pick('internal_comments', 2000),
    next_action: pick('next_action', 500),
    education: pick('education', 2000),
    certifications: pick('certifications', 2000),
    linkedin_url: pick('linkedin_url', 500),
    portfolio_url: pick('portfolio_url', 500),
    experience_summary: pick('experience_summary', 4000),
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
