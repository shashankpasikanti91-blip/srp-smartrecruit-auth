export const CANDIDATE_COLUMN_STORAGE_KEY = 'srp_candidate_columns'

/** Universal contact order: Name → Phone → Email (all tables / exports). */
export const CANDIDATE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'nric', label: 'NRIC' },
  { key: 'client', label: 'Client' },
  { key: 'hire_type', label: 'Hire Type' },
  { key: 'applying_for', label: 'Applying For' },
  { key: 'experience', label: 'Experience' },
  { key: 'source', label: 'Source' },
  { key: 'ai_score', label: 'AI Score' },
  { key: 'screened_job', label: 'Screened Job' },
  { key: 'location', label: 'Location' },
  { key: 'current_role', label: 'Current Role' },
  { key: 'parsed', label: 'Parsed' },
  { key: 'status', label: 'Status' },
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'recruiter', label: 'Recruiter' },
  { key: 'cv', label: 'CV' },
  { key: 'actions', label: 'Actions' },
] as const

export type CandidateColumnKey = (typeof CANDIDATE_COLUMNS)[number]['key']

const DEFAULT_VISIBLE = new Set<CandidateColumnKey>(CANDIDATE_COLUMNS.map(c => c.key))

export function loadCandidateColumnPrefs(): Set<CandidateColumnKey> {
  if (typeof window === 'undefined') return new Set(DEFAULT_VISIBLE)
  try {
    const raw = localStorage.getItem(CANDIDATE_COLUMN_STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_VISIBLE)
    const parsed = JSON.parse(raw) as string[]
    const valid = parsed.filter(k => DEFAULT_VISIBLE.has(k as CandidateColumnKey)) as CandidateColumnKey[]
    if (valid.length === 0) return new Set(DEFAULT_VISIBLE)
    return new Set(valid)
  } catch {
    return new Set(DEFAULT_VISIBLE)
  }
}

export function saveCandidateColumnPrefs(cols: Set<CandidateColumnKey>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CANDIDATE_COLUMN_STORAGE_KEY, JSON.stringify([...cols]))
}
