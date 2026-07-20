import { pool } from './db'

export type TimelineWrite = {
  tenantId: string
  entityType: 'job' | 'candidate' | 'submission' | 'interview' | 'offer' | 'employee' | 'client' | 'document' | 'follow_up' | 'email' | 'whatsapp'
  entityId: string
  resumeId?: string | null
  eventType: string
  title: string
  detail?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  meta?: Record<string, unknown>
}

/**
 * Auto-write a timeline event. Never throws — Recruitment OS must not break callers.
 */
export async function writeTimeline(ev: TimelineWrite): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO entity_timeline
         (tenant_id, entity_type, entity_id, resume_id, event_type, title, detail, actor_user_id, actor_email, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        ev.tenantId,
        ev.entityType,
        ev.entityId,
        ev.resumeId ?? null,
        ev.eventType,
        ev.title,
        ev.detail ?? null,
        ev.actorUserId ?? null,
        ev.actorEmail ?? null,
        JSON.stringify(ev.meta ?? {}),
      ]
    )
  } catch (e) {
    console.warn('[timeline]', e instanceof Error ? e.message : e)
  }
}

export async function listEntityTimeline(opts: {
  tenantId: string
  resumeId?: string
  entityType?: string
  entityId?: string
  limit?: number
}): Promise<{
  id: string
  entity_type: string
  entity_id: string
  event_type: string
  title: string
  detail: string | null
  actor_email: string | null
  meta: unknown
  created_at: Date
}[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50))
  const params: unknown[] = [opts.tenantId]
  let sql = `SELECT id, entity_type, entity_id, event_type, title, detail, actor_email, meta, created_at
             FROM entity_timeline WHERE tenant_id = $1`
  let p = 2
  if (opts.resumeId) {
    sql += ` AND resume_id = $${p}`
    params.push(opts.resumeId)
    p++
  }
  if (opts.entityType) {
    sql += ` AND entity_type = $${p}`
    params.push(opts.entityType)
    p++
  }
  if (opts.entityId) {
    sql += ` AND entity_id = $${p}`
    params.push(opts.entityId)
    p++
  }
  sql += ` ORDER BY created_at DESC LIMIT $${p}`
  params.push(limit)
  try {
    const { rows } = await pool.query(sql, params)
    return rows
  } catch {
    return []
  }
}
