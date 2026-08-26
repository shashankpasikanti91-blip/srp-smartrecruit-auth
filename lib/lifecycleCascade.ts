/**
 * Deterministic pipeline cascade: status changes create the next domain record.
 * Spec: docs/master/02-recruitment/Lifecycle-Mapping.md
 *
 * Shortlisted / Interview Scheduled → interviews row (to_schedule or scheduled)
 * Interview / submission Selected → offer_cases + docs / letter / joining fields
 */

import { pool } from './db'
import { logAudit } from './audit'
import { writeTimeline } from './timelineEngine'
import { createNotification } from './notificationCenter'
import { upsertWorkflowInstance } from './workflowEngine'
import { nextYearSeqId, getDocumentChecklist } from './recruitmentOs'
import { advanceFromDomain, interviewStatusToLifecycle, offerStatusToLifecycle } from './lifecycle'
import { mergeHrOps } from './opsList'

const CLOSED_INTERVIEW = ['cancelled', 'rejected', 'no_show', 'interviewer_no_show']
const CLOSED_OFFER = ['dropped', 'cancelled', 'no_show', 'offer_rejected']

export type CascadeActor = {
  tenantId: string
  userId: string
  userEmail: string
}

export type InterviewEnsureInput = CascadeActor & {
  resumeId: string
  jobPostId?: string | null
  submissionId?: string | null
  candidateName: string
  candidateEmail?: string | null
  scheduledAt?: Date | string | null
  format?: 'video' | 'phone' | 'in_person'
  notes?: string | null
  round?: number | null
}

export type OfferEnsureInput = CascadeActor & {
  resumeId: string
  submissionId?: string | null
  jobPostId?: string | null
  interviewId?: string | null
  candidateName?: string | null
}

type InterviewRow = {
  id: string
  short_id: string
  status: string
  scheduled_at: string | null
  resume_id: string
  job_post_id: string | null
}

type OfferRow = {
  id: string
  short_id?: string | null
  status: string
  resume_id: string
}

async function findOpenInterview(opts: {
  tenantId: string
  resumeId: string
  jobPostId?: string | null
  round?: number | null
}): Promise<InterviewRow | null> {
  const round = opts.round != null && Number(opts.round) >= 1 ? Math.floor(Number(opts.round)) : null
  try {
    const { rows } = await pool.query<InterviewRow>(
      `SELECT id, short_id, status, scheduled_at, resume_id, job_post_id
       FROM interviews
       WHERE tenant_id = $1 AND resume_id = $2
         AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','rejected','no_show','interviewer_no_show')
         AND ($3::uuid IS NULL OR job_post_id IS NULL OR job_post_id = $3)
         AND ($4::int IS NULL OR COALESCE(round, 1) = $4)
       ORDER BY
         CASE WHEN status = 'to_schedule' THEN 0 ELSE 1 END,
         scheduled_at DESC NULLS LAST
       LIMIT 1`,
      [opts.tenantId, opts.resumeId, opts.jobPostId ?? null, round],
    )
    return rows[0] ?? null
  } catch {
    const { rows } = await pool.query<InterviewRow>(
      `SELECT id, short_id, status, scheduled_at, resume_id, job_post_id
       FROM interviews
       WHERE tenant_id = $1 AND resume_id = $2
         AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','rejected','no_show','interviewer_no_show')
         AND ($3::uuid IS NULL OR job_post_id IS NULL OR job_post_id = $3)
       ORDER BY
         CASE WHEN status = 'to_schedule' THEN 0 ELSE 1 END,
         scheduled_at DESC NULLS LAST
       LIMIT 1`,
      [opts.tenantId, opts.resumeId, opts.jobPostId ?? null],
    )
    return rows[0] ?? null
  }
}

async function findOpenOffer(opts: {
  tenantId: string
  resumeId: string
  submissionId?: string | null
}): Promise<OfferRow | null> {
  const { rows } = await pool.query<OfferRow>(
    `SELECT id, short_id, status, resume_id
     FROM offer_cases
     WHERE tenant_id = $1 AND resume_id = $2
       AND LOWER(COALESCE(status, '')) <> ALL($3::text[])
       AND ($4::uuid IS NULL OR submission_id IS NULL OR submission_id = $4)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [opts.tenantId, opts.resumeId, CLOSED_OFFER, opts.submissionId ?? null],
  )
  return rows[0] ?? null
}

function parseWhen(raw?: Date | string | null): Date | null {
  if (!raw) return null
  const d = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Ensure an interview exists for this candidate+job.
 * No datetime → status `to_schedule` (still listed). Datetime → `scheduled`.
 */
export async function ensureInterviewForSubmission(
  input: InterviewEnsureInput,
): Promise<{ interview: InterviewRow; created: boolean; upgraded: boolean } | null> {
  try {
    const when = parseWhen(input.scheduledAt ?? null)
    const roundVal = input.round != null && Number(input.round) >= 1
      ? Math.floor(Number(input.round))
      : null
    const existing = await findOpenInterview({
      tenantId: input.tenantId,
      resumeId: input.resumeId,
      jobPostId: input.jobPostId,
      round: roundVal,
    })

    if (existing) {
      if (when && (existing.status === 'to_schedule' || !existing.scheduled_at)) {
        await pool.query(
          `UPDATE interviews
           SET scheduled_at = $1, status = 'scheduled', format = COALESCE($2, format),
               notes = COALESCE($3, notes), job_post_id = COALESCE(job_post_id, $4),
               updated_at = NOW()
           WHERE id = $5 AND tenant_id = $6`,
          [
            when.toISOString(),
            input.format ?? null,
            input.notes ?? null,
            input.jobPostId ?? null,
            existing.id,
            input.tenantId,
          ],
        )
        existing.status = 'scheduled'
        existing.scheduled_at = when.toISOString()
        await advanceFromDomain({
          tenantId: input.tenantId,
          resumeId: input.resumeId,
          toStage: interviewStatusToLifecycle('scheduled'),
          jobPostId: input.jobPostId,
          relatedEntityType: 'interview',
          relatedEntityId: existing.id,
          actorUserId: input.userId,
          actorEmail: input.userEmail,
          reason: 'cascade_interview_scheduled',
        })
        return { interview: existing, created: false, upgraded: true }
      }
      await advanceFromDomain({
        tenantId: input.tenantId,
        resumeId: input.resumeId,
        toStage: interviewStatusToLifecycle(existing.status),
        jobPostId: input.jobPostId ?? existing.job_post_id,
        relatedEntityType: 'interview',
        relatedEntityId: existing.id,
        actorUserId: input.userId,
        actorEmail: input.userEmail,
        reason: 'cascade_interview_exists',
      })
      return { interview: existing, created: false, upgraded: false }
    }

    const shortId = await nextYearSeqId(pool, { tenantId: input.tenantId, table: 'interviews', prefix: 'INT' })
    const preferredStatus = when ? 'scheduled' : 'to_schedule'
    const email = (input.candidateEmail ?? '').trim() || null
    const format = input.format ?? 'video'
    const scheduledAtVal = when ? when.toISOString() : null
    const insertRound = roundVal ?? 1

    let inserted: InterviewRow | null = null
    const safeEmail = email || 'unscheduled@local'
    const notes = input.notes ?? (when ? null : 'Pending interview slot')
    const insertSql: Array<{ sql: string; params: unknown[] }> = [
      {
        sql: `INSERT INTO interviews
             (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
              interviewer_id, user_id, scheduled_at, duration_minutes, format, notes, status, round, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,NOW())
           RETURNING id, short_id, status, scheduled_at, resume_id, job_post_id`,
        params: [
          shortId, input.tenantId, input.resumeId, input.jobPostId ?? null,
          input.candidateName, safeEmail, input.userId,
          scheduledAtVal, 60, format, notes, preferredStatus, insertRound,
        ],
      },
      {
        sql: `INSERT INTO interviews
             (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
              interviewer_id, user_id, scheduled_at, duration_minutes, format, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,NOW())
           RETURNING id, short_id, status, scheduled_at, resume_id, job_post_id`,
        params: [
          shortId, input.tenantId, input.resumeId, input.jobPostId ?? null,
          input.candidateName, safeEmail, input.userId,
          scheduledAtVal, 60, format, notes, preferredStatus,
        ],
      },
      {
        sql: `INSERT INTO interviews
             (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
              interviewer_id, scheduled_at, duration_minutes, format, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
           RETURNING id, short_id, status, scheduled_at, resume_id, job_post_id`,
        params: [
          shortId, input.tenantId, input.resumeId, input.jobPostId ?? null,
          input.candidateName, safeEmail, input.userId,
          scheduledAtVal, 60, format, notes, preferredStatus,
        ],
      },
      {
        sql: `INSERT INTO interviews
             (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
              user_id, scheduled_at, duration_minutes, format, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
           RETURNING id, short_id, status, scheduled_at, resume_id, job_post_id`,
        params: [
          shortId, input.tenantId, input.resumeId, input.jobPostId ?? null,
          input.candidateName, safeEmail, input.userId,
          scheduledAtVal, 60, format, notes, preferredStatus,
        ],
      },
      {
        sql: `INSERT INTO interviews
             (short_id, tenant_id, resume_id, job_post_id, candidate_name, candidate_email,
              interviewer_id, user_id, scheduled_at, duration_minutes, format, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,NOW())
           RETURNING id, short_id, status, scheduled_at, resume_id, job_post_id`,
        params: [
          shortId, input.tenantId, input.resumeId, input.jobPostId ?? null,
          input.candidateName, safeEmail, input.userId,
          scheduledAtVal, 60, format, notes, 'scheduled',
        ],
      },
    ]
    let lastErr: unknown = null
    for (const attempt of insertSql) {
      try {
        const { rows } = await pool.query<InterviewRow>(attempt.sql, attempt.params)
        inserted = rows[0] ?? null
        if (inserted) break
      } catch (e) {
        lastErr = e
      }
    }
    if (!inserted) {
      console.error('[lifecycleCascade.ensureInterview] insert failed', lastErr)
      return null
    }
    const status = inserted.status || preferredStatus

    try {
    await writeTimeline({
      tenantId: input.tenantId,
      entityType: 'interview',
      entityId: inserted.id,
      resumeId: input.resumeId,
      eventType: when ? 'interview_scheduled' : 'interview_to_schedule',
      title: when ? 'Interview Scheduled' : 'Interview — awaiting slot',
      detail: `${shortId}${input.submissionId ? ` · from submission` : ''}`,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
    })

    await createNotification({
      tenantId: input.tenantId,
      userId: input.userId,
      category: 'interview',
      title: when
        ? `Interview scheduled — ${input.candidateName}`
        : `Interview ready to schedule — ${input.candidateName}`,
      body: shortId,
      resumeId: input.resumeId,
      entityType: 'interview',
      entityId: inserted.id,
    })

    await upsertWorkflowInstance({
      tenantId: input.tenantId,
      entityType: 'interview',
      entityId: inserted.id,
      stage: status,
      resumeId: input.resumeId,
      jobPostId: input.jobPostId ?? null,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
      detail: when ? 'Interview scheduled' : 'Pick a date and time',
    })

    await advanceFromDomain({
      tenantId: input.tenantId,
      resumeId: input.resumeId,
      toStage: interviewStatusToLifecycle(status),
      jobPostId: input.jobPostId,
      relatedEntityType: 'interview',
      relatedEntityId: inserted.id,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
      reason: `cascade_interview:${status}`,
    })

    void logAudit({
      userId: input.userId,
      userEmail: input.userEmail,
      tenantId: input.tenantId,
      action: 'interview_cascaded',
      resourceType: 'interview',
      resourceId: inserted.id,
      resumeId: input.resumeId,
      details: { short_id: shortId, status, job_post_id: input.jobPostId },
    })
    } catch (e) {
      console.error('[lifecycleCascade.ensureInterview] side effects (row still saved)', e)
    }

    return { interview: inserted, created: true, upgraded: false }
  } catch (e) {
    console.error('[lifecycleCascade.ensureInterview]', e)
    return null
  }
}

/**
 * Ensure an offer case exists after selection: docs collection, letter draft, joining date empty.
 */
export async function ensureOfferForSelection(
  input: OfferEnsureInput,
): Promise<{ offer: OfferRow; created: boolean } | null> {
  try {
    const existing = await findOpenOffer({
      tenantId: input.tenantId,
      resumeId: input.resumeId,
      submissionId: input.submissionId,
    })
    if (existing) {
      await advanceFromDomain({
        tenantId: input.tenantId,
        resumeId: input.resumeId,
        toStage: offerStatusToLifecycle(existing.status),
        jobPostId: input.jobPostId,
        relatedEntityType: 'offer',
        relatedEntityId: existing.id,
        actorUserId: input.userId,
        actorEmail: input.userEmail,
        reason: 'cascade_offer_exists',
      })
      return { offer: existing, created: false }
    }

    const shortId = await nextYearSeqId(pool, { tenantId: input.tenantId, table: 'offer_cases', prefix: 'OFF' })
    const checklist = Object.fromEntries(
      getDocumentChecklist('MY', 'local').map(item => [item.key, false]),
    )
    const hrOps = mergeHrOps({}, {
      offer_letter: 'draft',
      hr_discussion: 'pending',
      joined_status: 'not_joined',
    })

    let inserted: OfferRow | null = null
    try {
      const { rows } = await pool.query<OfferRow>(
        `INSERT INTO offer_cases
           (tenant_id, resume_id, submission_id, user_id, status, offer_salary, expected_joining,
            employment_type, hr_checklist, notes, short_id, salary_breakdown, remarks, country_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$14)
         RETURNING id, short_id, status, resume_id`,
        [
          input.tenantId, input.resumeId, input.submissionId ?? null, input.userId,
          'document_collection', null, null, 'local',
          JSON.stringify(checklist),
          input.interviewId ? `Auto-created from interview ${input.interviewId}` : 'Auto-created after selection',
          shortId, JSON.stringify(hrOps), 'docs_status:collecting', 'MY',
        ],
      )
      inserted = rows[0]
    } catch {
      try {
        const { rows } = await pool.query<OfferRow>(
          `INSERT INTO offer_cases
             (tenant_id, resume_id, submission_id, user_id, status, hr_checklist, notes)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
           RETURNING id, short_id, status, resume_id`,
          [
            input.tenantId, input.resumeId, input.submissionId ?? null, input.userId,
            'selected', JSON.stringify(checklist),
            'Auto-created after selection',
          ],
        )
        inserted = rows[0]
      } catch {
        const { rows } = await pool.query<OfferRow>(
          `INSERT INTO offer_cases
             (tenant_id, resume_id, user_id, status, notes)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, short_id, status, resume_id`,
          [
            input.tenantId, input.resumeId, input.userId,
            'selected', 'Auto-created after selection',
          ],
        )
        inserted = rows[0]
      }
    }

    if (!inserted) return null

    if (input.submissionId) {
      try {
        await pool.query(
          `UPDATE submissions SET stage = 'selected', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2
             AND stage NOT IN ('rejected','rejected_by_candidate','submission_withdrawn','joined')`,
          [input.submissionId, input.tenantId],
        )
      } catch { /* ignore */ }
    }

    await writeTimeline({
      tenantId: input.tenantId,
      entityType: 'offer',
      entityId: inserted.id,
      resumeId: input.resumeId,
      eventType: 'offer_created',
      title: 'Offer & onboarding opened',
      detail: `${inserted.short_id ?? shortId} · documents + letter + joining`,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
    })

    await createNotification({
      tenantId: input.tenantId,
      userId: input.userId,
      category: 'offer',
      title: `Offer case opened${input.candidateName ? ` — ${input.candidateName}` : ''}`,
      body: 'Collect documents, draft offer letter, set date of joining.',
      resumeId: input.resumeId,
      entityType: 'offer',
      entityId: inserted.id,
    })

    await upsertWorkflowInstance({
      tenantId: input.tenantId,
      entityType: 'offer',
      entityId: inserted.id,
      stage: inserted.status,
      resumeId: input.resumeId,
      jobPostId: input.jobPostId ?? null,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
      detail: 'Document collection + offer letter + joining',
    })

    await advanceFromDomain({
      tenantId: input.tenantId,
      resumeId: input.resumeId,
      toStage: offerStatusToLifecycle(inserted.status),
      jobPostId: input.jobPostId,
      relatedEntityType: 'offer',
      relatedEntityId: inserted.id,
      actorUserId: input.userId,
      actorEmail: input.userEmail,
      reason: 'cascade_offer_selected',
    })

    void logAudit({
      userId: input.userId,
      userEmail: input.userEmail,
      tenantId: input.tenantId,
      action: 'offer_cascaded',
      resourceType: 'offer',
      resourceId: inserted.id,
      resumeId: input.resumeId,
      details: { short_id: inserted.short_id, status: inserted.status },
    })

    return { offer: inserted, created: true }
  } catch (e) {
    console.error('[lifecycleCascade.ensureOffer]', e)
    return null
  }
}

const INTERVIEW_TRIGGER_STAGES = new Set([
  'shortlisted',
  'interview',
  'interview_scheduled',
  'interview_completed',
])

const OFFER_TRIGGER_STAGES = new Set([
  'selected',
  'offer',
  'offer_released',
])

const CLOSE_SHARE_STAGES = new Set([
  'rejected',
  'rejected_by_candidate',
  'submission_withdrawn',
  'withdrawn',
  'position_closed',
  'hold',
  'no_show',
])

export function submissionStageNeedsInterview(stage: string): boolean {
  return INTERVIEW_TRIGGER_STAGES.has((stage ?? '').toLowerCase())
}

export function submissionStageNeedsOffer(stage: string): boolean {
  return OFFER_TRIGGER_STAGES.has((stage ?? '').toLowerCase())
}

export function submissionStageClosesShare(stage: string): boolean {
  return CLOSE_SHARE_STAGES.has((stage ?? '').toLowerCase())
}

/** Close open interviews (and pending offers) for this job so a "no" does not leak into the next stage. */
export async function closeShareForJob(opts: CascadeActor & {
  resumeId: string
  jobPostId?: string | null
  submissionId?: string | null
  reason: string
}): Promise<void> {
  try {
    await pool.query(
      `UPDATE interviews SET status = 'cancelled', updated_at = NOW()
       WHERE tenant_id = $1 AND resume_id = $2
         AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','rejected','no_show','interviewer_no_show','selected','completed')
         AND ($3::uuid IS NULL OR job_post_id IS NULL OR job_post_id = $3)`,
      [opts.tenantId, opts.resumeId, opts.jobPostId ?? null],
    )
    if (opts.submissionId) {
      await pool.query(
        `UPDATE offer_cases SET status = 'cancelled', updated_at = NOW()
         WHERE tenant_id = $1 AND resume_id = $2 AND submission_id = $3
           AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','offer_rejected','dropped','joined','no_show')`,
        [opts.tenantId, opts.resumeId, opts.submissionId],
      )
    }
    void logAudit({
      userId: opts.userId,
      userEmail: opts.userEmail,
      tenantId: opts.tenantId,
      action: 'share_closed',
      resourceType: 'candidate',
      resourceId: opts.resumeId,
      resumeId: opts.resumeId,
      details: { job_post_id: opts.jobPostId, submission_id: opts.submissionId, reason: opts.reason },
    })
  } catch (e) {
    console.error('[lifecycleCascade.closeShareForJob]', e)
  }
}
