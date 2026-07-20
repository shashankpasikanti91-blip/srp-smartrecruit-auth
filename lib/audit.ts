import { pool } from './db'
import { writeTimeline } from './timelineEngine'

export interface AuditEvent {
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  result?: 'success' | 'failure' | 'partial'
  tenantId?: string
  /** Field-level change tracking */
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  ipAddress?: string | null
  module?: string | null
  /** Link to candidate timeline when applicable */
  resumeId?: string | null
}

/**
 * Write an audit log entry + optional timeline event. Fires-and-forgets — never throws.
 */
export async function logAudit(ev: AuditEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, resource_type, resource_id, details, result, tenant_id,
          old_value, new_value, reason, ip_address, module)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        ev.userId,
        ev.userEmail,
        ev.action,
        ev.resourceType,
        ev.resourceId ?? null,
        JSON.stringify({
          ...(ev.details ?? {}),
          ...(ev.oldValue != null || ev.newValue != null
            ? { old_value: ev.oldValue, new_value: ev.newValue }
            : {}),
        }),
        ev.result ?? 'success',
        ev.tenantId ?? null,
        ev.oldValue ?? null,
        ev.newValue ?? null,
        ev.reason ?? null,
        ev.ipAddress ?? null,
        ev.module ?? ev.resourceType,
      ]
    )
  } catch {
    // Fallback without new columns (pre-v23)
    try {
      await pool.query(
        `INSERT INTO audit_logs
           (user_id, user_email, action, resource_type, resource_id, details, result, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          ev.userId,
          ev.userEmail,
          ev.action,
          ev.resourceType,
          ev.resourceId ?? null,
          JSON.stringify(ev.details ?? {}),
          ev.result ?? 'success',
          ev.tenantId ?? null,
        ]
      )
    } catch {
      /* audit failure must never break the caller */
    }
  }

  if (ev.tenantId && ev.resumeId) {
    const title = ev.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    await writeTimeline({
      tenantId: ev.tenantId,
      entityType: mapResourceToEntity(ev.resourceType),
      entityId: ev.resourceId ?? ev.resumeId,
      resumeId: ev.resumeId,
      eventType: ev.action,
      title,
      detail: ev.reason
        ?? (ev.oldValue != null && ev.newValue != null
          ? `${ev.oldValue} → ${ev.newValue}`
          : null),
      actorUserId: ev.userId,
      actorEmail: ev.userEmail,
      meta: ev.details,
    })
  }
}

function mapResourceToEntity(resourceType: string): TimelineWriteEntity {
  const map: Record<string, TimelineWriteEntity> = {
    candidate: 'candidate',
    job: 'job',
    job_post: 'job',
    submission: 'submission',
    interview: 'interview',
    offer: 'offer',
    offer_cases: 'offer',
    employee: 'employee',
    client: 'client',
    document: 'document',
    follow_up: 'follow_up',
  }
  return map[resourceType] ?? 'candidate'
}

type TimelineWriteEntity =
  | 'job' | 'candidate' | 'submission' | 'interview' | 'offer'
  | 'employee' | 'client' | 'document' | 'follow_up' | 'email' | 'whatsapp'
