/**
 * SRP SmartRecruit — Recruitment OS shared enums, labels, IDs, document templates.
 * Keeps modules aligned without rewriting APIs from scratch.
 */

/** Year-sequence short IDs: SUB-2026-000234 */
export async function nextYearSeqId(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { n: string }[] }> },
  opts: { tenantId: string; table: string; prefix: 'SUB' | 'INT' | 'OFF' | 'FOL' },
): Promise<string> {
  const year = new Date().getFullYear()
  const like = `${opts.prefix}-${year}-%`
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::text AS n FROM ${opts.table}
       WHERE tenant_id = $1 AND short_id LIKE $2`,
      [opts.tenantId, like],
    )
    const seq = String(parseInt(rows[0]?.n ?? '0', 10) + 1).padStart(6, '0')
    return `${opts.prefix}-${year}-${seq}`
  } catch {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let id = `${opts.prefix}-`
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
    return id
  }
}

export const SUBMISSION_STAGES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'client_review', label: 'Client Reviewing' },
  { value: 'shortlisted', label: 'Client Shortlisted' },
  { value: 'interview', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'waiting_feedback', label: 'Waiting Feedback' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected by Client' },
  { value: 'rejected_by_candidate', label: 'Rejected by Candidate' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'position_closed', label: 'Position Closed' },
  { value: 'hold', label: 'Position On Hold' },
  { value: 'submission_withdrawn', label: 'Submission Withdrawn' },
  { value: 'offer', label: 'Offer Process' },
  { value: 'offer_released', label: 'Offer Released' },
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'offer_declined', label: 'Offer Declined' },
  { value: 'joined', label: 'Joined' },
  { value: 'no_show', label: 'No Show' },
] as const

export type SubmissionStage = (typeof SUBMISSION_STAGES)[number]['value']

export const INTERVIEW_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'Candidate No Show' },
  { value: 'interviewer_no_show', label: 'Interviewer No Show' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'selected', label: 'Selected' },
  { value: 'awaiting_feedback', label: 'Awaiting Feedback' },
  { value: 'offer_discussion', label: 'Offer Discussion' },
] as const

export const OFFER_STATUSES = [
  { value: 'selected', label: 'Selected' },
  { value: 'document_collection', label: 'Document Collection' },
  { value: 'document_verification', label: 'Document Verification' },
  { value: 'offer_draft', label: 'Offer Draft' },
  { value: 'offer_released', label: 'Offer Released' },
  { value: 'offer_signed', label: 'Offer Signed' },
  { value: 'salary_negotiation', label: 'Salary Negotiation' },
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'offer_rejected', label: 'Offer Declined' },
  { value: 'joining_confirmed', label: 'Joining Confirmed' },
  { value: 'joining_followup', label: 'Joining Follow-up' },
  { value: 'joined', label: 'Joined' },
  { value: 'background_verification', label: 'Background Verification' },
  { value: 'probation', label: 'Probation' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

/** Map broken legacy UI values → DB-safe offer status */
export function normalizeOfferStatus(raw: string): string {
  const map: Record<string, string> = {
    negotiation: 'salary_negotiation',
    accepted: 'offer_accepted',
    declined: 'offer_rejected',
    withdrawn: 'cancelled',
  }
  return map[raw] ?? raw
}

export function labelFor(
  list: readonly { value: string; label: string }[],
  value: string,
): string {
  return list.find(x => x.value === value)?.label ?? value.replace(/_/g, ' ')
}

export type EmploymentType = 'local' | 'foreign'
export type ChecklistCountry = 'MY' | 'IN' | 'SG' | 'AU' | 'CA' | 'AE' | 'OTHER'

export type DocTemplateItem = { key: string; label: string; required?: boolean }

const MY_LOCAL: DocTemplateItem[] = [
  { key: 'education', label: 'Educational Documents', required: true },
  { key: 'ic', label: 'IC', required: true },
  { key: 'epf', label: 'EPF', required: true },
  { key: 'socso', label: 'SOCSO', required: true },
  { key: 'income_tax', label: 'Income Tax', required: false },
  { key: 'payslips', label: '3 Payslips', required: true },
  { key: 'offer_letter', label: 'Offer Letter', required: true },
  { key: 'bank_details', label: 'Bank Details', required: true },
  { key: 'photo', label: 'Photo', required: true },
]

const MY_FOREIGN: DocTemplateItem[] = [
  { key: 'education', label: 'Educational Documents', required: true },
  { key: 'passport', label: 'Passport', required: true },
  { key: 'visa', label: 'Visa', required: true },
  { key: 'ep', label: 'Employment Pass / EP', required: true },
  { key: 'passport_copy', label: 'Passport Copy', required: true },
  { key: 'photo', label: 'Photo', required: true },
  { key: 'experience_letter', label: 'Experience Letters', required: false },
  { key: 'payslips', label: 'Payslips', required: false },
  { key: 'offer_letter', label: 'Offer Letter', required: true },
  { key: 'medical', label: 'Medical', required: true },
  { key: 'bestinet', label: 'Bestinet', required: false },
  { key: 'immigration', label: 'Immigration Documents', required: false },
]

const IN_LOCAL: DocTemplateItem[] = [
  { key: 'education_10', label: '10th', required: true },
  { key: 'education_12', label: '12th', required: true },
  { key: 'degree', label: 'Degree', required: true },
  { key: 'aadhaar', label: 'Aadhaar', required: true },
  { key: 'pan', label: 'PAN', required: true },
  { key: 'passport', label: 'Passport', required: false },
  { key: 'pf', label: 'PF Number', required: false },
  { key: 'uan', label: 'UAN', required: false },
  { key: 'form16', label: 'Form 16', required: false },
  { key: 'bank_details', label: 'Bank', required: true },
  { key: 'photo', label: 'Photo', required: true },
  { key: 'payslips', label: 'Payslips', required: false },
  { key: 'experience_letter', label: 'Experience Letters', required: false },
  { key: 'offer_letter', label: 'Offer Letter', required: true },
  { key: 'relieving', label: 'Relieving Letter', required: false },
]

const SG: DocTemplateItem[] = [
  { key: 'nric', label: 'NRIC', required: false },
  { key: 'fin', label: 'FIN', required: false },
  { key: 'passport', label: 'Passport', required: true },
  { key: 'education', label: 'Education', required: true },
  { key: 'ep', label: 'Employment Pass', required: false },
  { key: 'payslips', label: 'Payslips', required: false },
  { key: 'medical', label: 'Medical', required: false },
  { key: 'cpf', label: 'CPF', required: false },
]

const AU: DocTemplateItem[] = [
  { key: 'tfn', label: 'TFN', required: true },
  { key: 'passport', label: 'Passport', required: true },
  { key: 'visa', label: 'Visa', required: false },
  { key: 'police', label: 'Police Clearance', required: false },
  { key: 'bank_details', label: 'Bank', required: true },
  { key: 'super', label: 'Superannuation', required: false },
]

const CA: DocTemplateItem[] = [
  { key: 'sin', label: 'SIN', required: true },
  { key: 'passport', label: 'Passport', required: true },
  { key: 'pr', label: 'PR', required: false },
  { key: 'work_permit', label: 'Work Permit', required: false },
]

const AE: DocTemplateItem[] = [
  { key: 'visa', label: 'Visa', required: true },
  { key: 'passport', label: 'Passport', required: true },
  { key: 'emirates_id', label: 'Emirates ID', required: true },
  { key: 'labour_card', label: 'Labour Card', required: false },
  { key: 'medical', label: 'Medical', required: true },
]

const DEFAULT_SLOTS: DocTemplateItem[] = [
  { key: 'resume', label: 'Resume / CV', required: true },
  { key: 'passport', label: 'Passport', required: false },
  { key: 'visa', label: 'Visa / Work Permit', required: false },
  { key: 'certificate', label: 'Certificates', required: false },
  { key: 'offer_letter', label: 'Offer Letter', required: true },
  { key: 'experience_letter', label: 'Experience Letter', required: false },
  { key: 'other', label: 'Other', required: false },
]

export function getDocumentChecklist(
  country: string,
  employmentType: EmploymentType = 'local',
): DocTemplateItem[] {
  const c = (country || 'OTHER').toUpperCase()
  if (c === 'MY' || c === 'MALAYSIA') {
    return employmentType === 'foreign' ? MY_FOREIGN : MY_LOCAL
  }
  if (c === 'IN' || c === 'INDIA') return IN_LOCAL
  if (c === 'SG' || c === 'SINGAPORE') return SG
  if (c === 'AU' || c === 'AUSTRALIA') return AU
  if (c === 'CA' || c === 'CANADA') return CA
  if (c === 'AE' || c === 'UAE' || c === 'DUBAI') return AE
  return DEFAULT_SLOTS
}

export const CHECKLIST_COUNTRIES: { code: ChecklistCountry; label: string }[] = [
  { code: 'MY', label: 'Malaysia' },
  { code: 'IN', label: 'India' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'AE', label: 'Dubai / UAE' },
  { code: 'OTHER', label: 'Other / Generic' },
]
