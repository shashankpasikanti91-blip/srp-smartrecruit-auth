import { pool } from './db'
import { writeTimeline } from './timelineEngine'
import { logRequest } from './requestLog'

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
  correlationId?: string | null
  actorType?: 'human' | 'system' | 'agent' | 'support_session' | null
}

/** Actions where a failed audit write should block the caller (fail closed). */
const HIGH_RISK_ACTIONS = new Set([
  'integration_delete',
  'integration_disconnect',
  'member_role_change',
  'member_remove',
  'member_invite',
  'secret_rotate',
  'provider_delete',
  'tenant_settings_security',
  'ownership_transfer',
  'candidate_merge',
  'candidate_delete',
  'job_delete',
  'governance_action',
  'mfa_disable',
  'session_revoke_all',
])

export function isHighRiskAuditAction(action: string): boolean {
  return HIGH_RISK_ACTIONS.has(action) || action.startsWith('destructive_')
}

async function insertAuditRow(ev: AuditEvent): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, resource_type, resource_id, details, result, tenant_id,
          old_value, new_value, reason, ip_address, module, correlation_id, actor_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
        ev.correlationId ?? null,
        ev.actorType ?? 'human',
      ]
    )
    return true
  } catch {
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
      return true
    } catch {
      return false
    }
  }
}

function alertAuditFailure(ev: AuditEvent, mode: 'open' | 'closed'): void {
  logRequest({
    requestId: ev.correlationId ?? `audit_${Date.now()}`,
    level: 'CRITICAL',
    method: 'AUDIT',
    path: '/internal/audit',
    status: 500,
    tenantId: ev.tenantId,
    userId: ev.userId,
    module: ev.module ?? ev.resourceType,
    action: ev.action,
    message: mode === 'closed'
      ? 'High-risk audit write failed — action blocked'
      : 'Audit write failed (fail-open)',
    meta: { resourceType: ev.resourceType, resourceId: ev.resourceId, mode },
  })
}

/**
 * Write an audit log entry + optional timeline event.
 * Default: fail-open (never throws) for availability.
 * High-risk actions: use logAuditStrict / requireAudit: true to fail closed.
 */
export async function logAudit(
  ev: AuditEvent & { requireAudit?: boolean }
): Promise<{ ok: boolean }> {
  const requireAudit = ev.requireAudit === true || isHighRiskAuditAction(ev.action)
  const ok = await insertAuditRow(ev)

  if (!ok) {
    alertAuditFailure(ev, requireAudit ? 'closed' : 'open')
    if (requireAudit) {
      throw new AuditWriteError(ev.action)
    }
  }

  if (ev.tenantId && ev.resumeId) {
    try {
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
    } catch {
      /* timeline is best-effort — never fail the domain write */
    }
  }

  return { ok }
}

/** Fail-closed audit for destructive / security-sensitive mutations. */
export async function logAuditStrict(ev: AuditEvent): Promise<void> {
  await logAudit({ ...ev, requireAudit: true })
}

export class AuditWriteError extends Error {
  constructor(action: string) {
    super(`Audit trail unavailable; blocked high-risk action: ${action}`)
    this.name = 'AuditWriteError'
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
