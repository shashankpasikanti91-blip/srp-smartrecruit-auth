/** Client-safe note constants (no DB imports). */
export const NOTE_ENTITY_TYPES = [
  'candidate',
  'submission',
  'interview',
  'offer',
  'follow_up',
  'client',
] as const

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
