/**
 * Lightweight resume field extraction (no AI).
 * Used by /api/parse and as fallback in /api/screen when the model omits name/email.
 */

import { resolveCandidateName, looksLikePersonName } from './nameClean'
import { formatPhoneInternational, splitGluedPhoneFromEmail } from './phoneFormat'

export { looksLikePersonName }

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{3,4}(?:\s*(?:ext|x)\.?\s*\d+)?/i

/** Prefer person-looking lines near top of resume; never invent. */
export function extractCandidateName(text: string, filename?: string | null): string | null {
  return resolveCandidateName(text, filename, null)
}

export function extractCandidateEmail(text: string): string | null {
  const m = text.match(EMAIL_RE)
  if (!m) return null
  const { email } = splitGluedPhoneFromEmail(m[0])
  return email || null
}

export function extractCandidatePhone(text: string): string | null {
  // Prefer lines labeled Phone / Mobile / Tel
  const labeled = text.match(
    /(?:phone|mobile|tel|contact|whatsapp|hp|handphone)\s*[:\-]?\s*([+\d][\d\s().\-\/]{6,40}\d)/i,
  )
  if (labeled?.[1]) {
    const formatted = formatPhoneInternational(labeled[1])
    if (formatted) return formatted
  }
  const m = text.match(PHONE_RE)
  if (!m) return null
  const formatted = formatPhoneInternational(m[0])
  return formatted || null
}

export function extractResumeFields(text: string, filename?: string | null) {
  const email = extractCandidateEmail(text)
  let phone = extractCandidatePhone(text)
  // Recover phone glued onto email if extract missed a labeled phone
  if (email) {
    const glued = splitGluedPhoneFromEmail(
      text.match(EMAIL_RE)?.[0] ?? email,
    )
    if (glued.phone && !phone) phone = glued.phone
  }
  return {
    name: extractCandidateName(text, filename),
    email,
    phone,
  }
}
