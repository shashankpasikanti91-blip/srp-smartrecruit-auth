/**
 * Malaysian NRIC (IC) helpers — format YYMMDD-PB-####, derive DOB/gender.
 * Shared by edit forms, list views, and candidate dossiers.
 */

const NRIC_DIGITS = /^\d{12}$/

/** Strip to digits only (max 12). */
export function nricDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 12)
}

/** Format as ######-##-#### while typing / for display. */
export function formatNric(value: string | null | undefined): string {
  const d = nricDigits(value)
  if (d.length <= 6) return d
  if (d.length <= 8) return `${d.slice(0, 6)}-${d.slice(6)}`
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`
}

export function isValidNric(value: string | null | undefined): boolean {
  return NRIC_DIGITS.test(nricDigits(value))
}

/** YYMMDD → ISO date (YY≤25 → 20xx else 19xx) — same rule as common MY ATS UIs. */
export function nricToDob(value: string | null | undefined): string | null {
  const d = nricDigits(value)
  if (d.length < 6) return null
  const yy = parseInt(d.slice(0, 2), 10)
  const mm = parseInt(d.slice(2, 4), 10)
  const dd = parseInt(d.slice(4, 6), 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const year = yy <= 25 ? 2000 + yy : 1900 + yy
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  const dt = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(dt.getTime())) return null
  return iso
}

/** Last digit odd → Male, even → Female (MY convention). */
export function nricToGender(value: string | null | undefined): 'Male' | 'Female' | null {
  const d = nricDigits(value)
  if (d.length < 12) return null
  const last = parseInt(d[11], 10)
  if (Number.isNaN(last)) return null
  return last % 2 === 1 ? 'Male' : 'Female'
}

/** Sanitize for storage: formatted if 12 digits, else trimmed free text (partial entry). */
export function sanitizeNric(value: unknown, maxLen = 20): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const d = nricDigits(trimmed)
  if (d.length === 12) return formatNric(d)
  return trimmed.slice(0, maxLen)
}
