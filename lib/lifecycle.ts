/**
 * Canonical recruitment lifecycle engine (P1).
 * Spec: docs/master/02-recruitment/Lifecycle-Mapping.md
 *
 * Storage: resumes.pipeline_stage holds the canonical stage.
 * History: lifecycle_events (append-only).
 */

import { pool } from './db'
import { logAudit } from './audit'
import { writeTimeline } from './timelineEngine'

export const LIFECYCLE_STAGES = [
  'sourced',
  'applied',
  'screening',
  'submitted',
  'interview',
  'offer',
  'hr_onboarding',
  'joined',
  'employee',
  'rejected',
  'withdrawn',
  'on_hold',
] as const

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  sourced: 'Sourced',
  applied: 'Applied',
  screening: 'Screening',
  submitted: 'Submitted',
  interview: 'Interview',
  offer: 'Offer',
  hr_onboarding: 'HR / Onboarding',
  joined: 'Joined',
  employee: 'Employee (ESS)',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  on_hold: 'On Hold',
}

/** Forward progress order (terminals excluded). */
const FORWARD_ORDER: LifecycleStage[] = [
  'sourced',
  'applied',
  'screening',
  'submitted',
  'interview',
  'offer',
  'hr_onboarding',
  'joined',
  'employee',
]

const TERMINALS = new Set<LifecycleStage>(['rejected', 'withdrawn', 'on_hold'])

const ALLOWED = new Set<string>(LIFECYCLE_STAGES)

/** Normalize legacy / alias values to canonical stages. */
export function normalizeLifecycleStage(raw: string | null | undefined): LifecycleStage | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === 'hired' || s === 'new') return s === 'hired' ? 'joined' : 'sourced'
  if (ALLOWED.has(s)) return s as LifecycleStage
  return null
}

export function stageRank(stage: LifecycleStage): number {
  if (TERMINALS.has(stage)) return -1
  const i = FORWARD_ORDER.indexOf(stage)
  return i >= 0 ? i : -1
}

/**
 * Whether moving from → to is allowed.
 * Forward moves and terminals always ok; same stage is no-op; regressions need force.
 */
export function assertTransition(
  from: LifecycleStage | null,
  to: LifecycleStage,
  opts?: { force?: boolean },
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED.has(to)) return { ok: false, error: `Invalid stage: ${to}` }
  if (!from || from === to) return { ok: true }
  if (opts?.force) return { ok: true }
  if (TERMINALS.has(to)) return { ok: true }
  // Leaving a terminal back into the funnel requires force
  if (TERMINALS.has(from)) {
    return { ok: false, error: `Cannot leave ${from} without force=true` }
  }
  const fromRank = stageRank(from)
  const toRank = stageRank(to)
  if (toRank >= fromRank) return { ok: true }
  return {
    ok: false,
    error: `Cannot regress from ${from} to ${to} without force=true`,
  }
}

/** Map domain submission stage → canonical lifecycle stage (or null = no change). */
export function submissionStageToLifecycle(stage: string | null | undefined): LifecycleStage | null {
  switch ((stage ?? '').toLowerCase()) {
    case 'draft':
      return null
    case 'submitted':
    case 'client_review':
    case 'shortlisted':
    case 'waiting_feedback':
      return 'submitted'
    case 'interview':
    case 'interview_completed':
      return 'interview'
    case 'selected':
    case 'offer':
    case 'offer_released':
      return 'offer'
    case 'offer_accepted':
      return 'hr_onboarding'
    case 'joined':
      return 'joined'
    case 'rejected':
    case 'rejected_by_candidate':
      return 'rejected'
    case 'submission_withdrawn':
    case 'position_closed':
      return 'withdrawn'
    case 'hold':
      return 'on_hold'
    default:
      return 'submitted'
  }
}

export function interviewStatusToLifecycle(status: string | null | undefined): LifecycleStage | null {
  switch ((status ?? '').toLowerCase()) {
    case 'scheduled':
    case 'confirmed':
    case 'rescheduled':
    case 'completed':
    case 'awaiting_feedback':
    case 'postponed':
      return 'interview'
    case 'selected':
    case 'offer_discussion':
      return 'offer'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
    case 'no_show':
      return null
    default:
      return 'interview'
  }
}

export function offerStatusToLifecycle(status: string | null | undefined): LifecycleStage | null {
  switch ((status ?? '').toLowerCase()) {
    case 'selected':
    case 'document_collection':
    case 'document_verification':
    case 'offer_draft':
    case 'offer_released':
    case 'offer_signed':
    case 'salary_negotiation':
      return 'offer'
    case 'offer_accepted':
    case 'joining_confirmed':
    case 'joining_followup':
    case 'background_verification':
    case 'onboarding':
    case 'probation':
      return 'hr_onboarding'
    case 'joined':
    case 'completed':
      return 'joined'
    case 'offer_rejected':
    case 'dropped':
    case 'no_show':
      return 'rejected'
    case 'cancelled':
      return 'withdrawn'
    default:
      return 'offer'
  }
}

export interface ApplyTransitionInput {
  tenantId: string
  resumeId: string
  toStage: LifecycleStage
  jobPostId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  reason?: string | null
  force?: boolean
  /** If true, skip when toStage would regress (no error). Default true for domain hooks. */
  advanceOnly?: boolean
}

export interface ApplyTransitionResult {
  applied: boolean
  fromStage: LifecycleStage | null
  toStage: LifecycleStage
  skipped?: boolean
  error?: string
}

/**
 * Transactional: update resumes.pipeline_stage + insert lifecycle_events + audit + timeline.
 * advanceOnly (default true): if transition would regress, skip silently (domain events shouldn't pull stages back).
 */
export async function applyTransition(input: ApplyTransitionInput): Promise<ApplyTransitionResult> {
  const toStage = input.toStage
  const advanceOnly = input.advanceOnly !== false

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{
      pipeline_stage: string | null
      short_id: string | null
    }>(
      `SELECT pipeline_stage, short_id FROM resumes WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [input.resumeId, input.tenantId],
    )

    if (!rows[0]) {
      await client.query('ROLLBACK')
      return { applied: false, fromStage: null, toStage, error: 'Candidate not found' }
    }

    const fromRaw = rows[0].pipeline_stage
    const fromStage = normalizeLifecycleStage(fromRaw) ?? (fromRaw as LifecycleStage | null)

    if (fromStage === toStage) {
      await client.query('ROLLBACK')
      return { applied: false, fromStage, toStage, skipped: true }
    }

    const check = assertTransition(fromStage, toStage, { force: input.force })
    if (!check.ok) {
      if (advanceOnly) {
        await client.query('ROLLBACK')
        return { applied: false, fromStage, toStage, skipped: true, error: check.error }
      }
      await client.query('ROLLBACK')
      return { applied: false, fromStage, toStage, error: check.error }
    }

    // advanceOnly: don't regress forward funnel
    if (advanceOnly && fromStage && !TERMINALS.has(toStage) && !input.force) {
      const fr = stageRank(fromStage)
      const tr = stageRank(toStage)
      if (fr >= 0 && tr >= 0 && tr < fr) {
        await client.query('ROLLBACK')
        return { applied: false, fromStage, toStage, skipped: true }
      }
    }

    await client.query(
      `UPDATE resumes SET pipeline_stage = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [toStage, input.resumeId, input.tenantId],
    )

    // Keep rich profile lifecycle_status loosely aligned for UI that still reads it
    try {
      await client.query(
        `UPDATE resumes
         SET candidate_profile = jsonb_set(
           COALESCE(candidate_profile, '{}'::jsonb),
           '{lifecycle_status}',
           to_jsonb($1::text),
           true
         )
         WHERE id = $2 AND tenant_id = $3`,
        [toStage, input.resumeId, input.tenantId],
      )
    } catch {
      /* candidate_profile may be missing on very old DBs */
    }

    await client.query(
      `INSERT INTO lifecycle_events
         (tenant_id, resume_id, job_post_id, from_stage, to_stage,
          related_entity_type, related_entity_id, actor_user_id, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.tenantId,
        input.resumeId,
        input.jobPostId ?? null,
        fromStage,
        toStage,
        input.relatedEntityType ?? null,
        input.relatedEntityId ?? null,
        input.actorUserId ?? null,
        input.reason ?? null,
      ],
    )

    await client.query('COMMIT')

    const label = LIFECYCLE_STAGE_LABELS[toStage] ?? toStage
    void logAudit({
      userId: input.actorUserId ?? 'system',
      userEmail: input.actorEmail ?? 'system',
      action: 'lifecycle_transition',
      resourceType: 'candidate',
      resourceId: rows[0].short_id ?? input.resumeId,
      tenantId: input.tenantId,
      resumeId: input.resumeId,
      module: 'lifecycle',
      oldValue: fromStage,
      newValue: toStage,
      reason: input.reason ?? undefined,
      details: {
        job_post_id: input.jobPostId,
        related_entity_type: input.relatedEntityType,
        related_entity_id: input.relatedEntityId,
      },
    })

    void writeTimeline({
      tenantId: input.tenantId,
      entityType: 'candidate',
      entityId: input.resumeId,
      resumeId: input.resumeId,
      eventType: 'lifecycle_transition',
      title: `Stage → ${label}`,
      detail: fromStage ? `${fromStage} → ${toStage}` : toStage,
      actorUserId: input.actorUserId ?? undefined,
      actorEmail: input.actorEmail ?? undefined,
      meta: {
        from_stage: fromStage,
        to_stage: toStage,
        job_post_id: input.jobPostId,
      },
    })

    return { applied: true, fromStage, toStage }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    console.error('[lifecycle.applyTransition]', e)
    return {
      applied: false,
      fromStage: null,
      toStage,
      error: e instanceof Error ? e.message : 'transition failed',
    }
  } finally {
    client.release()
  }
}

/** Helper for domain hooks: resolve target and apply if non-null. */
export async function advanceFromDomain(opts: {
  tenantId: string
  resumeId: string
  toStage: LifecycleStage | null
  jobPostId?: string | null
  relatedEntityType: string
  relatedEntityId: string
  actorUserId: string
  actorEmail: string
  reason?: string
}): Promise<ApplyTransitionResult | null> {
  if (!opts.toStage) return null
  return applyTransition({
    tenantId: opts.tenantId,
    resumeId: opts.resumeId,
    toStage: opts.toStage,
    jobPostId: opts.jobPostId,
    relatedEntityType: opts.relatedEntityType,
    relatedEntityId: opts.relatedEntityId,
    actorUserId: opts.actorUserId,
    actorEmail: opts.actorEmail,
    reason: opts.reason,
    advanceOnly: true,
  })
}
