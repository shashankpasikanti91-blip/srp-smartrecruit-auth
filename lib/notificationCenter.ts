import { pool } from './db'

export type NotificationCategory =
  | 'interview' | 'joining' | 'offer' | 'reminder' | 'approval'
  | 'documents' | 'visa' | 'attendance' | 'email' | 'whatsapp' | 'general'

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
  limit?: number
}) {
  const limit = Math.min(100, opts.limit ?? 30)
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

export async function unreadCount(userId: string, tenantId: string): Promise<number> {
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
