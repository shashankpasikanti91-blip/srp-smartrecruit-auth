/** Client-safe duplicate match type (mirrors server DuplicateMatch). */
export type DuplicateMatch = {
  id: string
  short_id: string
  candidate_name: string
  candidate_email: string | null
  pipeline_stage: string
  status: string
  created_at: string
  client_name: string | null
  owner_name: string | null
  owner_email: string | null
  matched_on: string[]
}
