/**
 * Universal phone normalization + international display formatting.
 * Auto-detects country from +/00/prefix/length; Malaysia (+60) is the fallback.
 */

export type FormatPhoneOptions = {
  /** ISO-ish fallback when detection fails. Default MY. */
  fallbackCc?: string
  /** Max length of returned display string. */
  maxLen?: number
}

const CC_DIAL: Record<string, string> = {
  MY: '60',
  IN: '91',
  PK: '92',
  SG: '65',
  ID: '62',
  PH: '63',
  AE: '971',
  GB: '44',
  UK: '44',
  US: '1',
  CA: '1',
  BD: '880',
  LK: '94',
  NP: '977',
  TH: '66',
  VN: '84',
  CN: '86',
  AU: '61',
  NZ: '64',
  SA: '966',
  QA: '974',
  KW: '965',
  BH: '973',
  OM: '968',
}

/** Longest-first dial codes we recognize when number starts with country code (no +). */
const DIAL_CODES_DESC = Array.from(
  new Set(Object.values(CC_DIAL)),
).sort((a, b) => b.length - a.length)

/**
 * Digits-only key for duplicate matching (last 10 national digits).
 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(-10)
}

/**
 * Split a cell that may contain multiple numbers ( / , ; | ).
 */
function splitPhoneParts(raw: string): string[] {
  return raw
    .split(/\s*(?:\/|,|;|\||\bor\b|\band\b)\s*/i)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Repair Excel-style negatives and strip junk before digit extraction.
 * "-9151077" → treat as digits that lost a leading 0.
 */
function repairRawToken(raw: string): string {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  // Excel often stores 012345 as -12345 when typed as number
  if (/^-\d{6,14}$/.test(s)) {
    s = '0' + s.slice(1)
  }
  // "+019..." mistaken local with plus
  if (/^\+0\d{7,12}$/.test(s)) {
    s = s.slice(1) // drop +, keep leading 0 for local MY path
  }
  return s
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

type Detected = { cc: string; national: string }

function detectFromDigits(digits: string, fallbackCc: string): Detected | null {
  if (!digits || digits.length < 7) return null

  // Explicit country already in digits (from + / 00 stripped)
  for (const dial of DIAL_CODES_DESC) {
    if (digits.startsWith(dial) && digits.length - dial.length >= 7 && digits.length - dial.length <= 12) {
      return { cc: dial, national: digits.slice(dial.length).replace(/^0+/, '') }
    }
  }

  // Local Malaysia: 01x… (9–11 digits with leading 0)
  if (/^01[0-9]\d{6,8}$/.test(digits)) {
    return { cc: '60', national: digits.replace(/^0/, '') }
  }
  // MY without 0: 1x… 8–10 digits
  if (/^1[0-9]\d{7,9}$/.test(digits) && digits.length <= 11) {
    return { cc: '60', national: digits }
  }

  // India mobile: 10 digits starting 6–9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return { cc: '91', national: digits }
  }

  // Singapore: 8 digits starting 8/9
  if (/^[89]\d{7}$/.test(digits)) {
    return { cc: '65', national: digits }
  }

  // Pakistan mobile often 03xx… (11 digits) or 3xx… (10)
  if (/^03\d{9}$/.test(digits)) {
    return { cc: '92', national: digits.replace(/^0/, '') }
  }
  if (/^3\d{9}$/.test(digits)) {
    return { cc: '92', national: digits }
  }

  // Indonesia 08… / Philippines 09…
  if (/^08\d{8,11}$/.test(digits)) {
    return { cc: '62', national: digits.replace(/^0/, '') }
  }
  if (/^09\d{8,10}$/.test(digits)) {
    return { cc: '63', national: digits.replace(/^0/, '') }
  }

  // Ambiguous short local — assume fallback (MY)
  const fb = CC_DIAL[fallbackCc.toUpperCase()] || '60'
  if (digits.length >= 8 && digits.length <= 11) {
    return { cc: fb, national: digits.replace(/^0+/, '') }
  }

  return null
}

function formatDisplay(cc: string, national: string): string {
  const n = national.replace(/\D/g, '')
  if (!n) return `+${cc}`

  // Malaysia mobile: +60 12 345 6789 (2+3+4) or +60 12 3456 7890
  if (cc === '60') {
    if (n.length === 9) return `+60 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
    if (n.length === 10) return `+60 ${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`
    if (n.length === 8) return `+60 ${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4)}`
    return `+60 ${n}`
  }

  // India: +91 62812 94878 (5+5) or +91 98xxx xxxxx
  if (cc === '91') {
    if (n.length === 10) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`
    return `+91 ${n}`
  }

  // Pakistan: +92 331 5149822
  if (cc === '92') {
    if (n.length >= 10) return `+92 ${n.slice(0, 3)} ${n.slice(3)}`
    return `+92 ${n}`
  }

  // Singapore: +65 9123 4567
  if (cc === '65') {
    if (n.length === 8) return `+65 ${n.slice(0, 4)} ${n.slice(4)}`
    return `+65 ${n}`
  }

  // US/CA: +1 555 123 4567
  if (cc === '1' && n.length === 10) {
    return `+1 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }

  // Generic: +CC + rest in groups of 3–4
  if (n.length <= 4) return `+${cc} ${n}`
  if (n.length <= 7) return `+${cc} ${n.slice(0, 3)} ${n.slice(3)}`
  if (n.length <= 10) return `+${cc} ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  return `+${cc} ${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`
}

/**
 * Format a single phone token to international display form.
 * Returns '' if unusable.
 */
export function formatOnePhone(raw: string | null | undefined, opts: FormatPhoneOptions = {}): string {
  const fallbackCc = (opts.fallbackCc || 'MY').toUpperCase()
  const maxLen = opts.maxLen ?? 40
  const repaired = repairRawToken(String(raw ?? ''))
  if (!repaired) return ''

  let working = repaired
  // 00 international prefix
  if (working.startsWith('00')) working = '+' + working.slice(2)

  let digits = onlyDigits(working)
  // If original had +, keep country from leading digits as-is via detect
  if (working.startsWith('+')) {
    // already international-ish
  }

  // Too short after repair — try padding MY excel loss (7–8 digit remnant)
  if (digits.length >= 6 && digits.length <= 8 && !working.startsWith('+')) {
    // Prefer MY mobile remnant: treat as missing leading 01
    if (/^[1-9]\d{6,7}$/.test(digits)) {
      digits = '0' + digits
    }
  }

  const detected = detectFromDigits(digits, fallbackCc)
  if (!detected) return ''

  const out = formatDisplay(detected.cc, detected.national)
  return out.slice(0, maxLen)
}

/**
 * Format phone field (supports multi-number cells).
 */
export function formatPhoneInternational(
  raw: string | null | undefined,
  opts: FormatPhoneOptions = {},
): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const parts = splitPhoneParts(s)
  if (parts.length <= 1) return formatOnePhone(s, opts)
  const formatted = parts.map(p => formatOnePhone(p, opts)).filter(Boolean)
  return formatted.join(' / ').slice(0, opts.maxLen ?? 80)
}

/**
 * If email has digits glued in front (0146453599user@yahoo.com), split them.
 */
export function splitGluedPhoneFromEmail(emailRaw: string | null | undefined): {
  email: string
  phone: string | null
} {
  const email = String(emailRaw ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { email: email || '', phone: null }

  const m = email.match(/^(\d{8,15})([a-z][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,})$/i)
  if (!m) return { email, phone: null }

  const phone = formatPhoneInternational(m[1]) || m[1]
  return { email: m[2].toLowerCase(), phone }
}

/**
 * Sanitize email: trim, lowercase, unglue phone prefix.
 */
export function sanitizeCandidateEmail(raw: string | null | undefined): string {
  const { email } = splitGluedPhoneFromEmail(raw)
  return email.slice(0, 320)
}
