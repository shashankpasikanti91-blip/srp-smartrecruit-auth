/** Canonical field labels for candidate forms — Phase 3.2 field audit */

export const CANDIDATE_FIELD_LABELS = {
  candidate_name: 'Full name',
  first_name: 'First name',
  last_name: 'Last name',
  candidate_email: 'Email',
  candidate_phone: 'Phone',
  location: 'Location',
  current_title: 'Current title',
  current_company: 'Current company',
  total_experience: 'Total experience',
  experience_summary: 'Experience summary',
  ai_skills: 'Skills',
  education: 'Education',
  nric: 'NRIC / IC',
  passport_number: 'Passport number',
  nationality: 'Nationality',
  linkedin_url: 'LinkedIn URL',
  pipeline_stage: 'Pipeline stage',
  status: 'Status',
  reviewer_notes: 'Notes',
  recruiter: 'Recruiter',
  source_type: 'Source',
  job_post_id: 'Linked job',
} as const

export type CandidateFieldKey = keyof typeof CANDIDATE_FIELD_LABELS

export function candidateFieldLabel(key: string): string {
  return (CANDIDATE_FIELD_LABELS as Record<string, string>)[key] ?? key.replace(/_/g, ' ')
}
