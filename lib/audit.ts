import { pool } from './db'

export interface AuditEvent {
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  result?: 'success' | 'failure' | 'partial'
}

/**
 * Write an audit log entry. Fires-and-forgets — never throws.
 */
export async function logAudit(ev: AuditEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, resource_type, resource_id, details, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ev.userId,
        ev.userEmail,
        ev.action,
        ev.resourceType,
        ev.resourceId ?? null,
        JSON.stringify(ev.details ?? {}),
        ev.result ?? 'success',
      ]
    )
  } catch {
    // audit failure must never break the caller
  }
}
