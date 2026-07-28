import { pool } from './db'
import { logAudit } from './audit'
import { createNotification } from './notificationCenter'
import { writeTimeline } from './timelineEngine'

export type DeleteResourceType = 'candidate' | 'job' | 'client'

export type DeleteRequestRow = {
  id: string
  tenant_id: string
  resource_type: DeleteResourceType
  resource_id: string
  resource_label: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requested_by: string
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  requester_email?: string | null
  requester_name?: string | null
}

/** Owner + admin (and anyone with explicit *.delete) can hard-delete / archive immediately. */
export function canDirectDelete(opts: {
  role: string | null | undefined
  permissions?: { jobs?: { delete?: boolean }; candidates?: { delete?: boolean } } | null
  resourceType: DeleteResourceType
}): boolean {
  if (opts.role === 'owner' || opts.role === 'admin') return true
  if (opts.resourceType === 'job') return Boolean(opts.permissions?.jobs?.delete)
  if (opts.resourceType === 'candidate') return Boolean(opts.permissions?.candidates?.delete)
  // Clients reuse candidates.delete for now (same data ownership)
  return Boolean(opts.permissions?.candidates?.delete)
}

export async function ensureDeleteRequestsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.delete_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('candidate', 'job', 'client')),
      resource_id UUID NOT NULL,
      resource_label TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      requested_by UUID NOT NULL REFERENCES public.auth_users(id),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_by UUID REFERENCES public.auth_users(id),
      reviewed_at TIMESTAMPTZ,
      review_note TEXT
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS delete_requests_pending_uniq
      ON public.delete_requests (tenant_id, resource_type, resource_id)
      WHERE status = 'pending'
  `).catch(() => {})
}

export async function notifyTenantApprovers(opts: {
  tenantId: string
  title: string
  body?: string
  entityType?: string
  entityId?: string
}): Promise<void> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM tenant_members
     WHERE tenant_id = $1 AND role IN ('owner', 'admin')`,
    [opts.tenantId]
  )
  await Promise.all(
    rows.map(r =>
      createNotification({
        tenantId: opts.tenantId,
        userId: r.user_id,
        category: 'approval',
        title: opts.title,
        body: opts.body,
        entityType: opts.entityType,
        entityId: opts.entityId,
        link: '/dashboard',
      })
    )
  )
}

/** Execute the actual delete/archive/deactivate. Returns false if not found. */
export async function executeResourceDelete(opts: {
  tenantId: string
  userId: string
  userEmail: string
  resourceType: DeleteResourceType
  resourceId: string
}): Promise<{ ok: boolean; label?: string; error?: string }> {
  const { tenantId, userId, userEmail, resourceType, resourceId } = opts

  if (resourceType === 'candidate') {
    const { rows } = await pool.query<{ id: string; short_id: string | null; candidate_name: string | null }>(
      `DELETE FROM resumes WHERE id = $1 AND tenant_id = $2
       RETURNING id, short_id, candidate_name`,
      [resourceId, tenantId]
    )
    if (!rows[0]) return { ok: false, error: 'Candidate not found' }
    const label = rows[0].short_id ?? rows[0].candidate_name ?? resourceId
    await logAudit({
      userId, userEmail,
      action: 'candidate_deleted',
      resourceType: 'candidate',
      resourceId: label,
      details: { resume_id: resourceId },
      tenantId,
      resumeId: resourceId,
    })
    await writeTimeline({
      tenantId,
      entityType: 'candidate',
      entityId: resourceId,
      eventType: 'candidate_deleted',
      title: 'Candidate deleted',
      detail: String(label),
      actorUserId: userId,
      actorEmail: userEmail,
    }).catch(() => {})
    return { ok: true, label: String(label) }
  }

  if (resourceType === 'job') {
    const { rows } = await pool.query<{ id: string; short_id: string | null; title: string }>(
      `UPDATE job_posts SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status != 'archived'
       RETURNING id, short_id, title`,
      [resourceId, tenantId]
    )
    if (!rows[0]) {
      // Already archived or missing
      const check = await pool.query(
        `SELECT id, short_id, title FROM job_posts WHERE id = $1 AND tenant_id = $2`,
        [resourceId, tenantId]
      )
      if (!check.rows[0]) return { ok: false, error: 'Job not found' }
      return { ok: true, label: check.rows[0].short_id ?? check.rows[0].title }
    }
    const label = rows[0].short_id ?? rows[0].title
    await logAudit({
      userId, userEmail,
      action: 'job_archived',
      resourceType: 'job',
      resourceId: label,
      details: { job_id: resourceId },
      tenantId,
    })
    await writeTimeline({
      tenantId,
      entityType: 'job',
      entityId: resourceId,
      eventType: 'job_archived',
      title: 'Job archived',
      detail: String(label),
      actorUserId: userId,
      actorEmail: userEmail,
    }).catch(() => {})
    return { ok: true, label: String(label) }
  }

  // client — soft deactivate
  const { rows } = await pool.query<{ id: string; name: string }>(
    `UPDATE clients SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE
     RETURNING id, name`,
    [resourceId, tenantId]
  )
  if (!rows[0]) {
    const check = await pool.query(
      `SELECT id, name FROM clients WHERE id = $1 AND tenant_id = $2`,
      [resourceId, tenantId]
    )
    if (!check.rows[0]) return { ok: false, error: 'Client not found' }
    return { ok: true, label: check.rows[0].name }
  }
  await logAudit({
    userId, userEmail,
    action: 'client_deactivated',
    resourceType: 'client',
    resourceId: rows[0].name,
    details: { client_id: resourceId },
    tenantId,
  })
  return { ok: true, label: rows[0].name }
}
