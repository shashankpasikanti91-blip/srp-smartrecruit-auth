import { pool } from './db'

export type NotificationCategory =
  | 'interview' | 'joining' | 'offer' | 'reminder' | 'approval'
  | 'documents' | 'visa' | 'attendance' | 'email' | 'whatsapp' | 'general'
  | 'ownership' | 'assignment' | 'bulk' | 'ai' | 'job' | 'mention' | 'task'
  | 'leave' | 'system'

export async function createNotification(opts: {
  tenantId: string
  userId: string
  category: NotificationCategory | string
  title: string
  body?: string | null
  link?: string | null
  entityType?: string | null
  entityId?: string | null
  resumeId?: string | null
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications
         (tenant_id, user_id, category, title, body, link, entity_type, entity_id, resume_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opts.tenantId,
        opts.userId,
        opts.category,
        opts.title,
        opts.body ?? null,
        opts.link ?? null,
        opts.entityType ?? null,
        opts.entityId ?? null,
        opts.resumeId ?? null,
      ]
    )
  } catch (e) {
    console.warn('[notification]', e instanceof Error ? e.message : e)
  }
}

export async function listNotifications(opts: {
  userId: string
  tenantId: string
  unreadOnly?: boolean
  archived?: boolean
  limit?: number
}) {
  const limit = Math.min(100, opts.limit ?? 30)
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND tenant_id = $2
         AND COALESCE(is_archived, FALSE) = $3
         ${opts.unreadOnly ? 'AND is_read = false' : ''}
       ORDER BY created_at DESC
       LIMIT $4`,
      [opts.userId, opts.tenantId, Boolean(opts.archived), limit]
    )
    return rows
  } catch {
    // Fallback before migrate_v32 (no is_archived)
    try {
      const { rows } = await pool.query(
        `SELECT * FROM notifications
         WHERE user_id = $1 AND tenant_id = $2
           ${opts.unreadOnly ? 'AND is_read = false' : ''}
         ORDER BY created_at DESC
         LIMIT $3`,
        [opts.userId, opts.tenantId, limit]
      )
      return rows
    } catch {
      return []
    }
  }
}

export async function unreadCount(userId: string, tenantId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM notifications
       WHERE user_id = $1 AND tenant_id = $2 AND is_read = false
         AND COALESCE(is_archived, FALSE) = FALSE`,
      [userId, tenantId]
    )
    return rows[0]?.cnt ?? 0
  } catch {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM notifications
         WHERE user_id = $1 AND tenant_id = $2 AND is_read = false`,
        [userId, tenantId]
      )
      return rows[0]?.cnt ?? 0
    } catch {
      return 0
    }
  }
}

export async function markNotificationsRead(opts: {
  userId: string
  tenantId: string
  ids?: string[]
}): Promise<void> {
  try {
    if (opts.ids?.length) {
      await pool.query(
        `UPDATE notifications SET is_read = true
         WHERE user_id = $1 AND tenant_id = $2 AND id = ANY($3::uuid[])`,
        [opts.userId, opts.tenantId, opts.ids]
      )
    } else {
      await pool.query(
        `UPDATE notifications SET is_read = true
         WHERE user_id = $1 AND tenant_id = $2 AND is_read = false`,
        [opts.userId, opts.tenantId]
      )
    }
  } catch {
    /* ignore */
  }
}

export async function archiveNotifications(opts: {
  userId: string
  tenantId: string
  ids: string[]
}): Promise<void> {
  if (!opts.ids.length) return
  try {
    await pool.query(
      `UPDATE notifications SET is_archived = TRUE, is_read = TRUE
       WHERE user_id = $1 AND tenant_id = $2 AND id = ANY($3::uuid[])`,
      [opts.userId, opts.tenantId, opts.ids]
    )
  } catch {
    /* migrate_v32 may be pending */
  }
}

export async function deleteNotifications(opts: {
  userId: string
  tenantId: string
  ids: string[]
}): Promise<void> {
  if (!opts.ids.length) return
  try {
    await pool.query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND tenant_id = $2 AND id = ANY($3::uuid[])`,
      [opts.userId, opts.tenantId, opts.ids]
    )
  } catch {
    /* ignore */
  }
}
