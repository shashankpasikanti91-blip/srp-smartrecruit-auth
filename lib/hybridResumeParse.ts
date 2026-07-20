/**
 * Hybrid resume field extraction with confidence scores (TekGen-style).
 * Rule-based first; AI can improve later via /api/candidates/parse-profile.
 */

import {
  extractCandidateName,
  extractCandidateEmail,
  extractCandidatePhone,
} from './resumeExtract'

export type FieldConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | null

export type ParsedField<T = string | null> = {
  value: T
  confidence: FieldConfidence
}

export type HybridResumeParse = {
  parser: 'hybrid' | 'ai'
  name: ParsedField
  first_name: ParsedField
  last_name: ParsedField
  email: ParsedField
  phone: ParsedField
  location: ParsedField
  current_title: ParsedField
  current_company: ParsedField
  total_experience: ParsedField
  skills: ParsedField
  education: ParsedField
  experience_summary: ParsedField
  nationality: ParsedField
  nric: ParsedField
  passport_number: ParsedField
  linkedin_url: ParsedField
  warnings: string[]
}

function pf(value: string | null | undefined, confidence: FieldConfidence): ParsedField {
  const v = value?.trim() || null
  return { value: v, confidence: v ? confidence : null }
}

function extractLocation(text: string): string | null {
  const labeled = text.match(/(?:location|address|based in|city)\s*[:\-]\s*([^\n,]{2,60})/i)
  if (labeled?.[1]) return labeled[1].trim()
  const myCities = text.match(/\b(Kuala Lumpur|Petaling Jaya|Klang|Penang|Johor Bahru|Shah Alam|Subang|Cyberjaya|Selangor|Singapore)\b/i)
  return myCities?.[1] ?? null
}

function extractSkills(text: string): string | null {
  const block = text.match(/(?:skills|technical skills|core competencies)\s*[:\-]?\s*\n?([\s\S]{20,800}?)(?:\n\s*\n|education|experience|employment|projects)/i)
  if (!block?.[1]) {
    // comma-ish skill line near top
    const line = text.split(/\n/).find(l => /,/.test(l) && l.length < 200 && /[A-Za-z]{2,}/.test(l) && !/@/.test(l))
    return line?.trim().slice(0, 500) ?? null
  }
  return block[1]
    .replace(/[•·▪◦]/g, ',')
    .split(/[,\n|/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 40)
    .slice(0, 25)
    .join(', ')
}

function extractEducation(text: string): string | null {
  const block = text.match(/(?:education|academic|qualification)s?\s*[:\-]?\s*\n([\s\S]{30,1200}?)(?:\n\s*\n|experience|employment|skills|projects|certification)/i)
  return block?.[1]?.trim().slice(0, 1500) ?? null
}

function extractTitle(text: string): string | null {
  const labeled = text.match(/(?:current(?:\s+role|\s+title)?|designation|position)\s*[:\-]\s*([^\n]{3,80})/i)
  if (labeled?.[1]) return labeled[1].trim()
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean).slice(0, 12)
  for (const line of lines.slice(1, 8)) {
    if (/\b(engineer|developer|analyst|manager|consultant|designer|qa|tester|architect|specialist)\b/i.test(line)
      && line.length < 80 && !/@/.test(line)) {
      return line
    }
  }
  return null
}

function extractCompany(text: string): string | null {
  const labeled = text.match(/(?:current(?:\s+company|\s+employer)?|company|employer)\s*[:\-]\s*([^\n]{2,100})/i)
  return labeled?.[1]?.trim() ?? null
}

function extractYears(text: string): string | null {
  const m = text.match(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i)
    || text.match(/(?:experience|exp)\s*[:\-]?\s*(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)/i)
  return m?.[1] ?? null
}

function extractNric(text: string): string | null {
  const m = text.match(/\b(\d{6}[-\s]?\d{2}[-\s]?\d{4})\b/)
  if (!m) return null
  const d = m[1].replace(/\D/g, '')
  if (d.length !== 12) return null
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`
}

function extractPassport(text: string): string | null {
  const m = text.match(/(?:passport)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]{6,12})/i)
  return m?.[1]?.toUpperCase() ?? null
}

function extractLinkedIn(text: string): string | null {
  const m = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i)
  return m?.[0] ?? null
}

function splitName(full: string | null): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null }
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** Rule-based hybrid parse — always review before save. */
export function hybridParseResume(text: string, filename?: string | null): HybridResumeParse {
  const warnings: string[] = [
    'Hybrid parser used — review every field before saving.',
    'IC / Passport / DOB are often missing from CVs — fill manually when needed.',
  ]
  const name = extractCandidateName(text, filename)
  const email = extractCandidateEmail(text)
  const phone = extractCandidatePhone(text)
  const { first, last } = splitName(name)
  const skills = extractSkills(text)
  const education = extractEducation(text)
  const title = extractTitle(text)
  const company = extractCompany(text)
  const years = extractYears(text)
  const location = extractLocation(text)
  const nric = extractNric(text)
  const passport = extractPassport(text)
  const linkedin = extractLinkedIn(text)

  if (!email && !phone) warnings.push('Only rule-based parser was used. Improve with AI only if needed to save tokens.')

  return {
    parser: 'hybrid',
    name: pf(name, name ? 'HIGH' : null),
    first_name: pf(first, first ? 'HIGH' : null),
    last_name: pf(last, last ? 'MEDIUM' : null),
    email: pf(email, email ? 'HIGH' : null),
    phone: pf(phone, phone ? 'HIGH' : null),
    location: pf(location, location ? 'HIGH' : null),
    current_title: pf(title, title ? 'MEDIUM' : null),
    current_company: pf(company, company ? 'HIGH' : null),
    total_experience: pf(years, years ? 'MEDIUM' : null),
    skills: pf(skills, skills ? 'MEDIUM' : null),
    education: pf(education, education ? 'MEDIUM' : null),
    experience_summary: pf(null, null),
    nationality: pf(nric ? 'Malaysian' : null, nric ? 'MEDIUM' : null),
    nric: pf(nric, nric ? 'HIGH' : null),
    passport_number: pf(passport, passport ? 'HIGH' : null),
    linkedin_url: pf(linkedin, linkedin ? 'HIGH' : null),
    warnings,
  }
}
