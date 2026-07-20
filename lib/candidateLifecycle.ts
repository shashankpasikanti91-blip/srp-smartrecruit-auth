/**
 * Candidate lifecycle + hire/visa enums for SRP Smart Recruit.
 * Lifecycle values aligned to the SRP Smart Recruit recruitment workflow.
 */

export const LIFECYCLE_STATUSES = [
  'new',
  'ai_screened',
  'recruiter_review',
  'contacted',
  'whatsapp_sent',
  'email_sent',
  'reached',
  'interested',
  'callback_requested',
  'not_answered',
  'not_interested',
  'submitted',
  'shortlisted',
  'interview_scheduled',
  'interview_completed',
  'client_review',
  'selected',
  'offer_released',
  'offer_accepted',
  'joined',
  'rejected',
  'hold',
  'future_pipeline',
] as const

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  new: 'New',
  ai_screened: 'AI Screened',
  recruiter_review: 'Recruiter Review',
  contacted: 'Contacted',
  whatsapp_sent: 'WhatsApp Sent',
  email_sent: 'Email Sent',
  reached: 'Reached',
  interested: 'Interested',
  callback_requested: 'Callback Requested',
  not_answered: 'Not Answered',
  not_interested: 'Not Interested',
  submitted: 'Submitted',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  client_review: 'Client Review',
  selected: 'Selected',
  offer_released: 'Offer Released',
  offer_accepted: 'Offer Accepted',
  joined: 'Joined',
  rejected: 'Rejected',
  hold: 'Hold',
  future_pipeline: 'Future Pipeline',
}

export const HIRE_TYPES = ['permanent', 'contract', 'freelance', 'internship'] as const
export type HireType = (typeof HIRE_TYPES)[number]
export const HIRE_TYPE_LABELS: Record<HireType, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
}

export const VISA_TYPES = [
  'citizen',
  'pr',
  'employment_pass',
  'work_permit',
  'student',
  'dependent',
  'not_applicable',
] as const
export type VisaType = (typeof VISA_TYPES)[number]
export const VISA_TYPE_LABELS: Record<VisaType, string> = {
  citizen: 'Citizen (Malaysian)',
  pr: 'Permanent Resident',
  employment_pass: 'Employment Pass',
  work_permit: 'Work Permit',
  student: 'Student',
  dependent: 'Dependent',
  not_applicable: 'Not Applicable',
}

export const INTERVIEW_MODES = ['video', 'phone', 'in_person', 'any'] as const

/** Map rich lifecycle → existing pipeline_stage for kanban compatibility. */
export function lifecycleToPipelineStage(status: string | null | undefined): string | null {
  switch (status) {
    case 'new':
      return 'sourced'
    case 'ai_screened':
    case 'recruiter_review':
      return 'screening'
    case 'contacted':
    case 'whatsapp_sent':
    case 'email_sent':
    case 'reached':
    case 'interested':
    case 'callback_requested':
    case 'not_answered':
    case 'not_interested':
      return 'applied'
    case 'submitted':
    case 'shortlisted':
    case 'client_review':
      return 'screening'
    case 'interview_scheduled':
    case 'interview_completed':
      return 'interview'
    case 'selected':
    case 'offer_released':
    case 'offer_accepted':
      return 'offer'
    case 'joined':
      return 'hired'
    case 'rejected':
      return 'rejected'
    case 'hold':
    case 'future_pipeline':
      return 'sourced'
    default:
      return null
  }
}

export function formatLifecycle(status: string | null | undefined): string {
  if (!status) return '—'
  if (status in LIFECYCLE_LABELS) return LIFECYCLE_LABELS[status as LifecycleStatus]
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
