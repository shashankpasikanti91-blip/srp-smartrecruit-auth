/**
 * Tenant-scoped ownership records with 90-day default validity.
 */
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const OWNERSHIP_ENTITY_TYPES = ['candidate', 'job', 'client', 'submission'] as const
export type OwnershipEntityType = (typeof OWNERSHIP_ENTITY_TYPES)[number]

export const DEFAULT_OWNERSHIP_DAYS = 90

export type OwnershipRecord = {
  id: string
  tenant_id: string
  entity_type: OwnershipEntityType
  entity_id: string
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
  assigned_at: string
  valid_until: string
  status: 'active' | 'expired' | 'transferred' | 'archived'
  transfer_reason: string | null
  approved_by: string | null
  previous_owner_id: string | null
}

export type OwnershipHistoryRow = {
  id: string
  action: string
  from_user_id: string | null
  to_user_id: string | null
  reason: string | null
  approved_by: string | null
  actor_user_id: string | null
  created_at: string
  from_name?: string | null
  to_name?: string | null
  actor_email?: string | null
}

export function isOwnershipEntityType(v: string): v is OwnershipEntityType {
  return (OWNERSHIP_ENTITY_TYPES as readonly string[]).includes(v)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

async function assertEntityExists(
  tenantId: string,
  entityType: OwnershipEntityType,
  entityId: string,
): Promise<boolean> {
  const table =
    entityType === 'candidate' ? 'resumes'
    : entityType === 'job' ? 'job_posts'
    : entityType === 'client' ? 'clients'
    : 'submissions'
  const { rows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [entityId, tenantId],
  )
  return rows.length > 0
}

export async function getActiveOwnership(
  tenantId: string,
  entityType: OwnershipEntityType,
  entityId: string,
): Promise<OwnershipRecord | null> {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.name AS owner_name, u.email AS owner_email
       FROM ownership_records o
       LEFT JOIN auth_users u ON u.id = o.owner_user_id
       WHERE o.tenant_id = $1 AND o.entity_type = $2 AND o.entity_id = $3 AND o.status = 'active'
       LIMIT 1`,
      [tenantId, entityType, entityId],
    )
    if (!rows[0]) return null
    const r = rows[0]
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      owner_user_id: r.owner_user_id,
      owner_name: r.owner_name ?? null,
      owner_email: r.owner_email ?? null,
      assigned_at: new Date(r.assigned_at).toISOString(),
      valid_until: new Date(r.valid_until).toISOString(),
      status: r.status,
      transfer_reason: r.transfer_reason ?? null,
      approved_by: r.approved_by ?? null,
      previous_owner_id: r.previous_owner_id ?? null,
    }
  } catch {
    return null
  }
}

export async function getOwnershipHistory(
  tenantId: string,
  entityType: OwnershipEntityType,
  entityId: string,
  limit = 30,
): Promise<OwnershipHistoryRow[]> {
  try {
    const { rows } = await pool.query(
      `SELECT h.*,
              fu.name AS from_name, tu.name AS to_name, au.email AS actor_email
       FROM ownership_history h
       LEFT JOIN auth_users fu ON fu.id = h.from_user_id
       LEFT JOIN auth_users tu ON tu.id = h.to_user_id
       LEFT JOIN auth_users au ON au.id = h.actor_user_id
       WHERE h.tenant_id = $1 AND h.entity_type = $2 AND h.entity_id = $3
       ORDER BY h.created_at DESC
       LIMIT $4`,
      [tenantId, entityType, entityId, limit],
    )
    return rows.map(r => ({
      id: r.id,
      action: r.action,
      from_user_id: r.from_user_id ?? null,
      to_user_id: r.to_user_id ?? null,
      reason: r.reason ?? null,
      approved_by: r.approved_by ?? null,
      actor_user_id: r.actor_user_id ?? null,
      created_at: new Date(r.created_at).toISOString(),
      from_name: r.from_name ?? null,
      to_name: r.to_name ?? null,
      actor_email: r.actor_email ?? null,
    }))
  } catch {
    return []
  }
}

async function writeHistory(opts: {
  tenantId: string
  ownershipRecordId: string | null
  entityType: OwnershipEntityType
  entityId: string
  action: string
  fromUserId?: string | null
  toUserId?: string | null
  reason?: string | null
  approvedBy?: string | null
  actorUserId?: string | null
  meta?: Record<string, unknown>
}) {
  await pool.query(
    `INSERT INTO ownership_history
       (tenant_id, ownership_record_id, entity_type, entity_id,
        from_user_id, to_user_id, action, reason, approved_by, actor_user_id, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [
      opts.tenantId,
      opts.ownershipRecordId,
      opts.entityType,
      opts.entityId,
      opts.fromUserId ?? null,
      opts.toUserId ?? null,
      opts.action,
      opts.reason ?? null,
      opts.approvedBy ?? null,
      opts.actorUserId ?? null,
      JSON.stringify(opts.meta ?? {}),
    ],
  )
}

/** Ensure an active ownership row exists; sync resumes.user_id for candidates. */
export async function ensureOwnership(opts: {
  tenantId: string
  entityType: OwnershipEntityType
  entityId: string
  ownerUserId: string
  actorUserId: string
  days?: number
}): Promise<OwnershipRecord | null> {
  const existing = await getActiveOwnership(opts.tenantId, opts.entityType, opts.entityId)
  if (existing) return existing

  const validUntil = addDays(new Date(), opts.days ?? DEFAULT_OWNERSHIP_DAYS)
  try {
    const { rows } = await pool.query(
      `INSERT INTO ownership_records
         (tenant_id, entity_type, entity_id, owner_user_id, valid_until, status)
       VALUES ($1,$2,$3,$4,$5,'active')
       RETURNING *`,
      [opts.tenantId, opts.entityType, opts.entityId, opts.ownerUserId, validUntil.toISOString()],
    )
    const rec = rows[0]
    await writeHistory({
      tenantId: opts.tenantId,
      ownershipRecordId: rec.id,
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: 'assign',
      toUserId: opts.ownerUserId,
      actorUserId: opts.actorUserId,
    })
    return getActiveOwnership(opts.tenantId, opts.entityType, opts.entityId)
  } catch {
    return null
  }
}

export async function transferOwnership(opts: {
  tenantId: string
  entityType: OwnershipEntityType
  entityId: string
  toUserId: string
  actorUserId: string
  actorEmail: string
  reason?: string
  approvedBy?: string
  extendDays?: number
  action?: 'transfer' | 'extend' | 'assign' | 'archive'
}): Promise<{ ok: boolean; error?: string; record?: OwnershipRecord | null }> {
  const exists = await assertEntityExists(opts.tenantId, opts.entityType, opts.entityId)
  if (!exists) return { ok: false, error: 'Entity not found' }

  const { rows: memberRows } = await pool.query(
    `SELECT user_id FROM tenant_members
     WHERE tenant_id = $1 AND user_id = $2 AND invite_accepted = TRUE`,
    [opts.tenantId, opts.toUserId],
  )
  if (!memberRows[0] && opts.action !== 'archive') {
    return { ok: false, error: 'Owner must be an accepted workspace member' }
  }

  const current = await getActiveOwnership(opts.tenantId, opts.entityType, opts.entityId)
  const action = opts.action ?? 'transfer'
  const now = new Date()

  if (action === 'archive') {
    if (current) {
      await pool.query(
        `UPDATE ownership_records SET status = 'archived', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [current.id, opts.tenantId],
      )
    }
    await writeHistory({
      tenantId: opts.tenantId,
      ownershipRecordId: current?.id ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: 'archive',
      fromUserId: current?.owner_user_id ?? null,
      reason: opts.reason,
      approvedBy: opts.approvedBy,
      actorUserId: opts.actorUserId,
    })
    logAudit({
      userId: opts.actorUserId,
      userEmail: opts.actorEmail,
      action: 'ownership_archived',
      resourceType: opts.entityType,
      resourceId: opts.entityId,
      details: { reason: opts.reason },
      tenantId: opts.tenantId,
    })
    return { ok: true, record: null }
  }

  const validUntil = action === 'extend' && current
    ? addDays(new Date(current.valid_until), opts.extendDays ?? DEFAULT_OWNERSHIP_DAYS)
    : addDays(now, opts.extendDays ?? DEFAULT_OWNERSHIP_DAYS)

  if (current) {
    await pool.query(
      `UPDATE ownership_records SET status = 'transferred', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [current.id, opts.tenantId],
    )
  }

  const { rows } = await pool.query(
    `INSERT INTO ownership_records
       (tenant_id, entity_type, entity_id, owner_user_id, valid_until, status,
        transfer_reason, approved_by, previous_owner_id)
     VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8)
     RETURNING id`,
    [
      opts.tenantId,
      opts.entityType,
      opts.entityId,
      opts.toUserId,
      validUntil.toISOString(),
      opts.reason ?? null,
      opts.approvedBy ?? null,
      current?.owner_user_id ?? null,
    ],
  )

  await writeHistory({
    tenantId: opts.tenantId,
    ownershipRecordId: rows[0]?.id ?? null,
    entityType: opts.entityType,
    entityId: opts.entityId,
    action,
    fromUserId: current?.owner_user_id ?? null,
    toUserId: opts.toUserId,
    reason: opts.reason,
    approvedBy: opts.approvedBy,
    actorUserId: opts.actorUserId,
  })

  if (opts.entityType === 'candidate') {
    await pool.query(
      `UPDATE resumes SET user_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [opts.toUserId, opts.entityId, opts.tenantId],
    )
  }

  logAudit({
    userId: opts.actorUserId,
    userEmail: opts.actorEmail,
    action: 'ownership_changed',
    resourceType: opts.entityType,
    resourceId: opts.entityId,
    details: { action, to_user_id: opts.toUserId, reason: opts.reason },
    tenantId: opts.tenantId,
  })

  const record = await getActiveOwnership(opts.tenantId, opts.entityType, opts.entityId)
  return { ok: true, record }
}

export function isOwnershipExpired(record: OwnershipRecord | null): boolean {
  if (!record) return false
  return new Date(record.valid_until).getTime() < Date.now()
}
