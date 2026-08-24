/**
 * Clean / validate candidate display names from AI, regex, or filenames.
 */

const SECTION_BLOCKLIST =
  /\b(professional\s+summary|summary|objective|profile|experience|education|skills|work\s+history|employment|contact|personal\s+details|curriculum\s+vitae|resume|references|declaration|certifications?|projects?|achievements?|languages?)\b/i

const JOB_TITLE_BLOCKLIST =
  /\b(manager|engineer|developer|designer|analyst|consultant|director|executive|specialist|officer|assistant|coordinator|administrator|architect|lead|head|intern|trainee|solutions?|software|senior|junior|principal|associate|president|ceo|cto|cfo|hr)\b/i

/** Malaysian / South Asian name particles — keep intact, do not treat as separators to drop. */
const NAME_PARTICLES = /^(bin|binti|b\.?|a\/l|a\/p|a\.l\.|a\.p\.|s\/o|d\/o|anak|van|von|de|da|del|della|di|le|la|el|al|ibn|bano?)$/i

/**
 * Strip score/ID prefixes and section noise; return cleaned person name or ''.
 */
export function cleanCandidateName(raw: string | null | undefined, maxLen = 200): string {
  let s = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''

  // Leading score / short id: "67 Rhenuga Renganathan", "55 John Doe"
  s = s.replace(/^\d{1,3}[\s._\-]+/, '').trim()
  // Trailing score in parentheses or dashes
  s = s.replace(/[\s\-–—]*\(\s*\d{1,3}\s*\)\s*$/, '').trim()
  s = s.replace(/\s+\d{1,3}\s*$/, '').trim()

  if (SECTION_BLOCKLIST.test(s)) return ''
  if (/^https?:\/\//i.test(s) || /@/.test(s)) return ''

  // Title Case cleanup for ALL CAPS (keep particles)
  if (s === s.toUpperCase() && /[A-Z]/.test(s) && s.length > 3) {
    s = s
      .split(/\s+/)
      .map(w => {
        if (NAME_PARTICLES.test(w)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        if (/^A\/[LP]$/i.test(w)) return w.toUpperCase()
        return w.charAt(0) + w.slice(1).toLowerCase()
      })
      .join(' ')
  }

  return s.slice(0, maxLen)
}

/**
 * Whether a cleaned line looks like a real person name (not a heading/job title).
 */
export function looksLikePersonName(line: string): boolean {
  const t = cleanCandidateName(line)
  if (!t || t.length < 3 || t.length > 80) return false
  if (SECTION_BLOCKLIST.test(t) || JOB_TITLE_BLOCKLIST.test(t)) return false
  if (/\d{3,}/.test(t)) return false
  if (/https?:\/\//i.test(t) || /www\./i.test(t) || /@/.test(t)) return false

  const words = t.split(/\s+/).filter(Boolean)
  // Allow longer MY names (Bin …)
  if (words.length < 2 || words.length > 8) return false

  const letterish = words.filter(w =>
    NAME_PARTICLES.test(w) || /^[A-Za-z][A-Za-z.'’\-]*$/.test(w) || /^A\/[LP]$/i.test(w),
  )
  if (letterish.length < 2) return false

  const titled = words.filter(w => /^[A-Z]/.test(w) || NAME_PARTICLES.test(w) || /^A\/[LP]$/i.test(w)).length
  return titled >= Math.min(2, words.length)
}

/**
 * Prefer labeled Name: lines; else first person-looking line; else cleaned filename.
 */
export function resolveCandidateName(
  text: string,
  filename?: string | null,
  aiName?: string | null,
): string | null {
  const fromAi = cleanCandidateName(aiName)
  if (fromAi && looksLikePersonName(fromAi)) return fromAi

  const labeled = text.match(
    /(?:^|\n)\s*(?:full\s*)?name\s*[:\-]\s*([^\n]{3,80})/i,
  )
  if (labeled?.[1]) {
    const n = cleanCandidateName(labeled[1])
    if (n && looksLikePersonName(n)) return n
  }

  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30)
  for (const line of lines) {
    if (looksLikePersonName(line)) return cleanCandidateName(line)
  }

  if (filename) {
    const base = filename
      .replace(/\.[^.]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\b(resume|cv|curriculum|vitae|latest|final|copy|updated|new)\b/gi, ' ')
      .replace(/^\d{1,3}\s+/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const cleaned = cleanCandidateName(base)
    if (cleaned && looksLikePersonName(cleaned)) return cleaned
  }

  return fromAi || null
}
