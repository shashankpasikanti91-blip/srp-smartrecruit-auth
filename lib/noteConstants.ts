/** Client-safe note constants (no DB imports). */
export const NOTE_ENTITY_TYPES = [
  'candidate',
  'submission',
  'interview',
  'offer',
  'follow_up',
  'client',
  'job',
] as const

export const NOTE_VISIBILITY = ['private', 'team'] as const
export type NoteVisibility = (typeof NOTE_VISIBILITY)[number]

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  private: 'Private (only me)',
  team: 'Team (shared)',
}

export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number]

export const NOTE_CATEGORIES = [
  'recruiter',
  'follow_up',
  'internal',
  'reviewer',
  'client_feedback',
  'general',
] as const

export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  recruiter: 'Recruiter note',
  follow_up: 'Follow-up',
  internal: 'Internal comment',
  reviewer: 'Reviewer note',
  client_feedback: 'Client feedback',
  general: 'General',
}

export function isNoteEntityType(v: string): v is NoteEntityType {
  return (NOTE_ENTITY_TYPES as readonly string[]).includes(v)
}

export function isNoteCategory(v: string): v is NoteCategory {
  return (NOTE_CATEGORIES as readonly string[]).includes(v)
}

export function isNoteVisibility(v: string): v is NoteVisibility {
  return (NOTE_VISIBILITY as readonly string[]).includes(v)
}
