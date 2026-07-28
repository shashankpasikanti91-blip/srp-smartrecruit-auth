/** Client-safe internal match row type. */
export type InternalMatchRow = {
  id: string
  short_id: string
  candidate_name: string
  match_percent: number
  ai_score: number | null
  skills: string[]
  experience: string | null
  location: string | null
  availability: string | null
  notice_period: string | null
  visa: string | null
  nationality: string | null
  recruiter_name: string | null
  recruiter_email: string | null
  pipeline_stage: string
}
