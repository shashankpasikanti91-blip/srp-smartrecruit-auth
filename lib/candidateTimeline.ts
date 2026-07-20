import { pool } from './db'
import { formatLifecycle } from './candidateLifecycle'

export type TimelineEvent = {
  id: string
  type: string
  title: string
  detail?: string | null
  actor_email?: string | null
  meta?: Record<string, unknown>
  at: string
}

const ACTION_LABELS: Record<string, string> = {
  candidate_updated: 'Profile Updated',
  stage_changed: 'Pipeline Stage Changed',
  ownership_changed: 'Recruiter Assigned',
  document_uploaded: 'Documents Uploaded',
  document_replaced: 'Document Replaced',
  resume_replaced: 'Resume Uploaded',
  resume_uploaded: 'Resume Uploaded',
  lifecycle_changed: 'Status Changed',
  submission_updated: 'Submission Updated',
  submission_created: 'Submission Created',
  ai_screened: 'Candidate Screened',
  candidate_created: 'Candidate Created',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  offer_released: 'Offer Released',
  offer_accepted: 'Offer Accepted',
  joined: 'Joined',
  follow_up_sent: 'Follow-up Sent',
}

function auditTitle(action: string, details: Record<string, unknown>): string {
  if (action === 'stage_changed' && details.stage) {
    return `Stage → ${String(details.stage)}`
  }
  if (action === 'lifecycle_changed' && details.status) {
    return `Status → ${formatLifecycle(String(details.status))}`
  }
  if (action === 'document_uploaded' && details.slot_type) {
    return `Document uploaded (${String(details.slot_type)})`
  }
  if (action === 'document_replaced' && details.slot_type) {
    return `Document replaced (${String(details.slot_type)}) v${details.version_no ?? ''}`
  }
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

export async function buildCandidateTimeline(opts: {
  tenantId: string
  resumeId: string
  shortId: string
  candidateEmail?: string | null
  limit?: number
  cursor?: string | null
}): Promise<{ events: TimelineEvent[]; next_cursor: string | null }> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50))
  const events: TimelineEvent[] = []

  const auditRes = await pool.query<{
    id: string
    action: string
    user_email: string
    details: unknown
    created_at: Date
  }>(
    `SELECT id, action, user_email, details, created_at
     FROM audit_logs
     WHERE tenant_id = $1 AND resource_type = 'candidate' AND resource_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [opts.tenantId, opts.shortId, limit]
  )

  for (const row of auditRes.rows) {
    let details: Record<string, unknown> = {}
    if (typeof row.details === 'string') {
      try { details = JSON.parse(row.details) } catch { /* ignore */ }
    } else if (row.details && typeof row.details === 'object') {
      details = row.details as Record<string, unknown>
    }
    events.push({
      id: `audit-${row.id}`,
      type: row.action,
      title: auditTitle(row.action, details),
      detail: details.field ? `${String(details.field)} updated` : null,
      actor_email: row.user_email,
      meta: details,
      at: new Date(row.created_at).toISOString(),
    })
  }

  const commRes = await pool.query<{
    id: string
    channel: string
    recipient: string
    subject: string | null
    status: string
    created_at: Date
  }>(
    `SELECT id, channel, recipient, subject, status, created_at
     FROM communication_logs
     WHERE (resume_id = $1 OR (tenant_id = $2 AND recipient = $3))
     ORDER BY created_at DESC
     LIMIT $4`,
    [opts.resumeId, opts.tenantId, opts.candidateEmail ?? '', limit]
  )

  for (const row of commRes.rows) {
    events.push({
      id: `comm-${row.id}`,
      type: `comm_${row.channel}`,
      title: `${row.channel.charAt(0).toUpperCase()}${row.channel.slice(1)} ${row.status}`,
      detail: row.subject ?? row.recipient,
      at: new Date(row.created_at).toISOString(),
    })
  }

  const interviewRes = await pool.query<{
    id: string
    short_id: string
    status: string
    scheduled_at: Date
    format: string | null
  }>(
    `SELECT id, short_id, status, scheduled_at, format
     FROM interviews
     WHERE tenant_id = $1 AND resume_id = $2
     ORDER BY scheduled_at DESC
     LIMIT $3`,
    [opts.tenantId, opts.resumeId, limit]
  )

  for (const row of interviewRes.rows) {
    events.push({
      id: `int-${row.id}`,
      type: 'interview',
      title: `Interview ${row.status}`,
      detail: row.short_id,
      meta: { format: row.format },
      at: new Date(row.scheduled_at).toISOString(),
    })
  }

  try {
    const entityRes = await pool.query<{
      id: string; event_type: string; title: string; detail: string | null
      actor_email: string | null; created_at: Date
    }>(
      `SELECT id, event_type, title, detail, actor_email, created_at
       FROM entity_timeline
       WHERE tenant_id = $1 AND resume_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [opts.tenantId, opts.resumeId, limit]
    )
    for (const row of entityRes.rows) {
      events.push({
        id: `etl-${row.id}`,
        type: row.event_type,
        title: row.title,
        detail: row.detail,
        actor_email: row.actor_email,
        at: new Date(row.created_at).toISOString(),
      })
    }
  } catch {
    /* entity_timeline may not exist yet */
  }

  try {
    const subRes = await pool.query<{
      id: string; short_id: string; stage: string; client_name: string | null; updated_at: Date; created_at: Date
    }>(
      `SELECT id, short_id, stage, client_name, updated_at, created_at FROM submissions
       WHERE tenant_id = $1 AND resume_id = $2 ORDER BY updated_at DESC LIMIT $3`,
      [opts.tenantId, opts.resumeId, limit]
    )
    for (const row of subRes.rows) {
      events.push({
        id: `sub-c-${row.id}`,
        type: 'submission_created',
        title: 'Submission Created',
        detail: row.client_name ? `${row.short_id} · ${row.client_name}` : row.short_id,
        at: new Date(row.created_at).toISOString(),
      })
      if (row.updated_at.getTime() !== row.created_at.getTime()) {
        events.push({
          id: `sub-${row.id}`,
          type: 'submission',
          title: `Submission ${row.stage.replace(/_/g, ' ')}`,
          detail: row.client_name ? `${row.short_id} · ${row.client_name}` : row.short_id,
          at: new Date(row.updated_at).toISOString(),
        })
      }
    }

    const offerRes = await pool.query<{
      id: string; status: string; offer_salary: string | null; updated_at: Date; short_id: string | null
    }>(
      `SELECT id, status, offer_salary, updated_at, short_id FROM offer_cases
       WHERE tenant_id = $1 AND resume_id = $2 ORDER BY updated_at DESC LIMIT $3`,
      [opts.tenantId, opts.resumeId, limit]
    )
    for (const row of offerRes.rows) {
      const statusTitle: Record<string, string> = {
        offer_released: 'Offer Released',
        offer_accepted: 'Offer Accepted',
        offer_rejected: 'Offer Declined',
        joined: 'Joined',
        joining_confirmed: 'Joining Confirmed',
        offer_draft: 'Offer Draft',
      }
      events.push({
        id: `offer-${row.id}`,
        type: 'offer',
        title: statusTitle[row.status] ?? `Offer ${row.status.replace(/_/g, ' ')}`,
        detail: [row.short_id, row.offer_salary].filter(Boolean).join(' · ') || null,
        at: new Date(row.updated_at).toISOString(),
      })
    }

    const fuRes = await pool.query<{
      id: string; title: string; status: string; due_at: Date
    }>(
      `SELECT id, title, status, due_at FROM follow_ups
       WHERE tenant_id = $1 AND resume_id = $2 ORDER BY due_at DESC LIMIT $3`,
      [opts.tenantId, opts.resumeId, limit]
    )
    for (const row of fuRes.rows) {
      events.push({
        id: `fu-${row.id}`,
        type: 'follow_up',
        title: row.title?.toLowerCase().includes('follow') ? row.title : `Follow-up Sent: ${row.title}`,
        detail: row.status,
        at: new Date(row.due_at).toISOString(),
      })
    }
  } catch {
    /* tables may not exist yet */
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1))
  let filtered = events
  if (opts.cursor) {
    filtered = events.filter(e => e.at < opts.cursor!)
  }
  const sliced = filtered.slice(0, limit)
  const next_cursor = sliced.length === limit ? sliced[sliced.length - 1]?.at ?? null : null
  return { events: sliced, next_cursor }
}
