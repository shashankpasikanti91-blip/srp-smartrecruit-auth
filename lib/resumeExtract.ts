/**
 * Lightweight resume field extraction (no AI).
 * Used by /api/parse and as fallback in /api/screen when the model omits name/email.
 */

const JOB_TITLE_BLOCKLIST = /\b(manager|engineer|developer|designer|analyst|consultant|director|executive|specialist|officer|assistant|coordinator|administrator|architect|lead|head|intern|trainee|solutions?|global|system|software|senior|junior|principal|associate|president|ceo|cto|cfo|hr|human\s+resources|resume|curriculum|vitae|cv)\b/i

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{3,4}(?:\s*(?:ext|x)\.?\s*\d+)?/i

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function looksLikePersonName(line: string): boolean {
  const t = cleanLine(line)
  if (t.length < 3 || t.length > 60) return false
  if (EMAIL_RE.test(t) || PHONE_RE.test(t)) return false
  if (/https?:\/\//i.test(t) || /www\./i.test(t)) return false
  if (JOB_TITLE_BLOCKLIST.test(t)) return false
  if (/\d{3,}/.test(t)) return false
  // 2–5 words, mostly letters
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  const letterWords = words.filter(w => /^[A-Za-z][A-Za-z.'’-]*$/.test(w))
  if (letterWords.length < 2) return false
  // Prefer Title Case / ALL CAPS person names
  const titled = words.filter(w => /^[A-Z]/.test(w)).length
  return titled >= Math.min(2, words.length)
}

/** Prefer person-looking lines near top of resume; never invent. */
export function extractCandidateName(text: string, filename?: string | null): string | null {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean).slice(0, 25)
  for (const line of lines) {
    if (looksLikePersonName(line)) return line
  }
  // Filename fallback only if it looks like a person (e.g. John_Doe_Resume.pdf)
  if (filename) {
    const base = filename
      .replace(/\.[^.]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\b(resume|cv|curriculum|vitae|latest|final|copy)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (looksLikePersonName(base)) return base
  }
  return null
}

export function extractCandidateEmail(text: string): string | null {
  const m = text.match(EMAIL_RE)
  return m ? m[0].toLowerCase() : null
}

export function extractCandidatePhone(text: string): string | null {
  // Prefer lines labeled Phone / Mobile / Tel
  const labeled = text.match(/(?:phone|mobile|tel|contact|whatsapp)\s*[:\-]?\s*([+\d][\d\s().\-]{7,20}\d)/i)
  if (labeled?.[1]) {
    const p = labeled[1].replace(/\s+/g, ' ').trim()
    if (p.replace(/\D/g, '').length >= 8) return p.slice(0, 50)
  }
  const m = text.match(PHONE_RE)
  if (!m) return null
  const digits = m[0].replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return m[0].replace(/\s+/g, ' ').trim().slice(0, 50)
}

export function extractResumeFields(text: string, filename?: string | null) {
  return {
    name: extractCandidateName(text, filename),
    email: extractCandidateEmail(text),
    phone: extractCandidatePhone(text),
  }
}
