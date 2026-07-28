/**
 * Tenant-scoped entity notes helpers + ownership checks.
 */
import { pool } from '@/lib/db'
import {
  isNoteCategory,
  isNoteEntityType,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  NOTE_ENTITY_TYPES,
  type NoteCategory,
  type NoteEntityType,
} from '@/lib/noteConstants'

export {
  isNoteCategory,
  isNoteEntityType,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  NOTE_ENTITY_TYPES,
  type NoteCategory,
  type NoteEntityType,
}

export type EntityNoteRow = {
  id: string
  tenant_id: string
  entity_type: NoteEntityType
  entity_id: string
  category: NoteCategory
  body: string
  author_user_id: string | null
  author_email: string | null
  author_name: string | null
  created_at: string
  updated_at: string | null
  edited_at: string | null
  is_deleted: boolean
  is_pinned?: boolean
  visibility?: 'private' | 'team'
  mentions?: unknown[]
  attachments?: unknown[]
}

/** Verify the entity belongs to the tenant. Returns false if not found / wrong tenant. */
export async function assertEntityInTenant(
  tenantId: string,
  entityType: NoteEntityType,
  entityId: string,
): Promise<boolean> {
  const table =
    entityType === 'candidate' ? 'resumes'
    : entityType === 'job' ? 'job_posts'
    : entityType === 'submission' ? 'submissions'
    : entityType === 'interview' ? 'interviews'
    : entityType === 'offer' ? 'offer_cases'
    : entityType === 'follow_up' ? 'follow_ups'
    : 'clients'

  const { rows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [entityId, tenantId],
  )
  return rows.length > 0
}
