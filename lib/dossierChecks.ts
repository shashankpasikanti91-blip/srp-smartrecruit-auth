/**
 * Country / nationality-aware candidate dossier completeness checks.
 * Never defaults to Malaysia NRIC for all countries.
 */
import { getDocumentChecklist, type EmploymentType } from '@/lib/recruitmentOs'

export type DossierLevel = 'required' | 'recommended'

export type DossierCheck = {
  id: string
  label: string
  level: DossierLevel
  ok: boolean
}

export type DossierCandidateLike = {
  candidate_name?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  raw_text?: string | null
  job_posts?: { id?: string; title?: string; short_id?: string } | null
  candidate_profile?: Record<string, unknown> | null
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/** Map free-text nationality / country to checklist country code. */
export function resolveChecklistCountry(
  nationalityOrCountry?: string | null,
  tenantDefaultCountry?: string | null,
): string {
  const raw = (nationalityOrCountry || tenantDefaultCountry || 'OTHER').trim().toLowerCase()
  if (!raw) return 'OTHER'
  if (raw === 'my' || raw.includes('malay') || raw.includes('malaysia')) return 'MY'
  if (raw === 'in' || raw.includes('india') || raw.includes('indian')) return 'IN'
  if (raw === 'sg' || raw.includes('singapore') || raw.includes('singaporean')) return 'SG'
  if (raw === 'au' || raw.includes('australia') || raw.includes('australian')) return 'AU'
  if (raw === 'ca' || raw.includes('canada') || raw.includes('canadian')) return 'CA'
  if (raw === 'ae' || raw.includes('uae') || raw.includes('emirates') || raw.includes('dubai')) return 'AE'
  return 'OTHER'
}

export function resolveEmploymentType(profile?: Record<string, unknown> | null): EmploymentType {
  const wa = str(profile?.work_authorization).toLowerCase()
  const visa = str(profile?.visa_type)
  const citizenLike = !wa || /\bcitizen\b|\bnational\b|n\.a\.|^na$|not applicable|n\/a/.test(wa)
  if (!citizenLike || visa) return 'foreign'
  return 'local'
}

/** Profile field presence for identity / country-specific dossier items. */
function identityFieldOk(profile: Record<string, unknown>, key: string): boolean {
  switch (key) {
    case 'ic':
    case 'nric':
      return !!(str(profile.nric) || (
        str(profile.id_document_type).toLowerCase().includes('nric') && str(profile.id_document_reference)
      ) || (
        str(profile.id_document_type).toLowerCase().includes('ic') && str(profile.id_document_reference)
      ))
    case 'fin':
      return !!(str(profile.fin) || (
        str(profile.id_document_type).toLowerCase().includes('fin') && str(profile.id_document_reference)
      ))
    case 'aadhaar':
      return !!str(profile.india_aadhaar_last4)
    case 'pan':
      return !!str(profile.india_pan)
    case 'passport':
    case 'passport_copy':
      return !!str(profile.passport_number)
    case 'tfn':
      return !!str(profile.tfn || profile.australia_tfn)
    case 'sin':
      return !!str(profile.sin || profile.canada_sin)
    case 'emirates_id':
      return !!str(profile.emirates_id || profile.id_document_reference)
    default:
      return false
  }
}

/** Identity-related checklist keys that map to profile fields (not file uploads). */
const IDENTITY_PROFILE_KEYS = new Set([
  'ic', 'nric', 'fin', 'aadhaar', 'pan', 'passport', 'passport_copy',
  'tfn', 'sin', 'emirates_id',
])

export function getCandidateDossierChecks(
  c: DossierCandidateLike,
  opts?: {
    tenantDefaultCountry?: string | null
    /** Optional tenant checklist override from hr-config */
    checklistOverride?: { key: string; label: string; required?: boolean }[] | null
  },
): DossierCheck[] {
  const p = (c.candidate_profile ?? {}) as Record<string, unknown>
  const nat = str(p.nationality)
  const country = resolveChecklistCountry(nat || str(p.work_country) || str(p.current_location), opts?.tenantDefaultCountry)
  const employmentType = resolveEmploymentType(p)
  const wa = str(p.work_authorization).toLowerCase()
  const citizenLike = !wa || /\bcitizen\b|\bnational\b|n\.a\.|^na$|not applicable|n\/a/.test(wa)

  const checks: DossierCheck[] = [
    { id: 'candidate_name', label: 'Candidate name', level: 'required', ok: !!str(c.candidate_name) },
    { id: 'candidate_email', label: 'Email', level: 'required', ok: !!str(c.candidate_email) },
    { id: 'candidate_phone', label: 'Phone', level: 'recommended', ok: !!str(c.candidate_phone) },
    { id: 'job_post', label: 'Assigned job', level: 'recommended', ok: !!c.job_posts?.id },
    { id: 'raw_text', label: 'Resume / CV text on file', level: 'recommended', ok: !!str(c.raw_text) },
    { id: 'current_company', label: 'Current company', level: 'recommended', ok: !!str(p.current_company) },
    { id: 'current_title', label: 'Current title', level: 'recommended', ok: !!str(p.current_title) },
    { id: 'current_location', label: 'Current location', level: 'recommended', ok: !!str(p.current_location) },
    { id: 'notice_period', label: 'Notice period', level: 'recommended', ok: !!str(p.notice_period) },
    { id: 'salary_expectation', label: 'Salary expectation', level: 'recommended', ok: !!str(p.salary_expectation) },
    { id: 'nationality', label: 'Nationality', level: 'recommended', ok: !!nat },
    { id: 'work_authorization', label: 'Work authorization', level: 'recommended', ok: !!str(p.work_authorization) },
    { id: 'visa_type', label: 'Visa type (if not citizen)', level: 'recommended', ok: citizenLike || !!str(p.visa_type) },
    { id: 'visa_expiry', label: 'Visa expiry (if visa)', level: 'recommended', ok: !str(p.visa_type) || !!str(p.visa_expiry) },
  ]

  const checklist = opts?.checklistOverride?.length
    ? opts.checklistOverride
    : getDocumentChecklist(country, employmentType)

  const countryLabel =
    country === 'MY' ? 'Malaysia'
    : country === 'IN' ? 'India'
    : country === 'SG' ? 'Singapore'
    : country === 'AU' ? 'Australia'
    : country === 'CA' ? 'Canada'
    : country === 'AE' ? 'UAE'
    : 'Identity'

  for (const item of checklist) {
    if (!IDENTITY_PROFILE_KEYS.has(item.key)) continue
    const level: DossierLevel = item.required ? 'recommended' : 'recommended'
    checks.push({
      id: `id_${item.key}`,
      label: `${countryLabel} — ${item.label}`,
      level,
      ok: identityFieldOk(p, item.key),
    })
  }

  return checks
}

export function getCandidateDossierStatus(
  c: DossierCandidateLike,
  opts?: Parameters<typeof getCandidateDossierChecks>[1],
) {
  const checks = getCandidateDossierChecks(c, opts)
  const requiredMissing = checks.filter(x => x.level === 'required' && !x.ok).map(x => x.label)
  const recommendedMissing = checks.filter(x => x.level === 'recommended' && !x.ok).map(x => x.label)
  const filled = checks.filter(x => x.ok).length
  const dossierPercent = checks.length ? Math.round((filled / checks.length) * 100) : 100
  const warnRecordIds = new Set(checks.filter(x => x.level === 'recommended' && !x.ok).map(x => x.id))
  return { checks, requiredMissing, recommendedMissing, dossierPercent, warnRecordIds, country: resolveChecklistCountry(str(c.candidate_profile?.nationality), opts?.tenantDefaultCountry) }
}

export function dossierDisplayValue(c: DossierCandidateLike, id: string): string {
  const p = (c.candidate_profile ?? {}) as Record<string, unknown>
  switch (id) {
    case 'candidate_name': return str(c.candidate_name) || '—'
    case 'candidate_email': return str(c.candidate_email) || '—'
    case 'candidate_phone': return str(c.candidate_phone) || '—'
    case 'job_post': return c.job_posts ? `${c.job_posts.title} (${c.job_posts.short_id ?? ''})` : '—'
    case 'raw_text': return c.raw_text ? `${c.raw_text.length.toLocaleString()} chars` : '—'
    case 'current_company': return str(p.current_company) || '—'
    case 'current_title': return str(p.current_title) || '—'
    case 'current_location': return str(p.current_location) || '—'
    case 'notice_period': return str(p.notice_period) || '—'
    case 'salary_expectation': return str(p.salary_expectation) || '—'
    case 'nationality': return str(p.nationality) || '—'
    case 'work_authorization': return str(p.work_authorization) || '—'
    case 'visa_type': return str(p.visa_type) || '—'
    case 'visa_expiry': return str(p.visa_expiry) || '—'
    case 'id_aadhaar':
    case 'india_aadhaar_last4': return str(p.india_aadhaar_last4) || '—'
    case 'id_pan':
    case 'india_pan': return str(p.india_pan) || '—'
    case 'id_ic':
    case 'id_nric':
    case 'nric': return str(p.nric) || str(p.id_document_reference) || '—'
    case 'id_passport':
    case 'id_passport_copy': return str(p.passport_number) || '—'
    case 'id_fin': return str(p.fin) || str(p.id_document_reference) || '—'
    default:
      if (id.startsWith('id_')) {
        const key = id.slice(3)
        return str(p[key]) || str(p.id_document_reference) || '—'
      }
      return '—'
  }
}
