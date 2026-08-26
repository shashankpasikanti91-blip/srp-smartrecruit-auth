import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { upsertWorkflowInstance } from '@/lib/workflowEngine'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'
import { advanceFromDomain, hasOtherOpenSubmissions, submissionStageToLifecycle } from '@/lib/lifecycle'
import {
  closeShareForJob,
  ensureInterviewForSubmission,
  ensureOfferForSelection,
  submissionStageClosesShare,
  submissionStageNeedsInterview,
  submissionStageNeedsOffer,
} from '@/lib/lifecycleCascade'

async function logSubmissionHistory(
  submissionId: string,
  tenantId: string,
  userId: string,
  action: string,
  oldStage: string | null,
  newStage: string | null,
  details: Record<string, unknown>
) {
  try {
    await pool.query(
      `INSERT INTO submission_history (submission_id, tenant_id, user_id, action, old_stage, new_stage, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [submissionId, tenantId, userId, action, oldStage, newStage, JSON.stringify(details)]
    )
  } catch { /* table may not exist */ }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { rows } = await pool.query(
    `SELECT s.*, r.candidate_name, r.short_id AS candidate_short_id
     FROM submissions s
     JOIN resumes r ON r.id = s.resume_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let history: unknown[] = []
  try {
    const h = await pool.query(
      `SELECT * FROM submission_history WHERE submission_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    )
    history = h.rows
  } catch { /* ignore */ }

  return NextResponse.json({ submission: rows[0], history })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  const canPatch =
    ctx.permissions.candidates.update
    || ctx.permissions.pipeline.update
    || ctx.permissions.candidates.create
  if (!canPatch) {
    return NextResponse.json({ error: 'Forbidden: you cannot update submissions' }, { status: 403 })
  }
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const prev = await pool.query<{
    stage: string
    resume_id: string
    job_post_id: string | null
    client_name: string | null
    applying_for: string | null
  }>(
    `SELECT stage, resume_id, job_post_id, client_name, applying_for
     FROM submissions WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!prev.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const oldStage = prev.rows[0].stage

  const body = await req.json()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  const fields = ['client_name', 'applying_for', 'hire_type', 'stage', 'lifecycle_status', 'notes'] as const
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = $${i++}`)
      vals.push(sanitizeText(body[f], f === 'notes' ? 5000 : 200))
    }
  }
  if (body.feedback !== undefined) {
    sets.push(`feedback = $${i++}::jsonb`)
    vals.push(JSON.stringify(body.feedback))
  }
  if (body.submission_date !== undefined) {
    sets.push(`submission_date = $${i++}`)
    vals.push(body.submission_date || null)
  }
  if (body.job_post_id !== undefined) {
    if (body.job_post_id && !isValidUUID(body.job_post_id)) {
      return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
    }
    sets.push(`job_post_id = $${i++}`)
    vals.push(body.job_post_id || null)
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  sets.push('updated_at = NOW()')
  vals.push(id, ctx.tenantId)

  const { rows } = await pool.query(
    `UPDATE submissions SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    vals
  )

  const cand = await pool.query<{
    short_id: string
    candidate_name: string
    candidate_email: string | null
  }>(
    'SELECT short_id, candidate_name, candidate_email FROM resumes WHERE id = $1',
    [prev.rows[0].resume_id]
  )
  const newStage = rows[0].stage as string
  await logSubmissionHistory(id, ctx.tenantId, ctx.userId, 'updated', oldStage, newStage, { fields: Object.keys(body) })

  logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail,
    action: 'submission_updated', resourceType: 'candidate',
    resourceId: cand.rows[0]?.short_id ?? id,
    details: { submission_id: id, stage: newStage, old_stage: oldStage },
    tenantId: ctx.tenantId,
  })

  if (newStage !== oldStage) {
    try {
    const stageTitles: Record<string, string> = {
      submitted: 'Submitted to Client',
      client_review: 'Client Reviewing',
      client_reviewing: 'Client Reviewing',
      shortlisted: 'Client Shortlisted',
      client_shortlisted: 'Client Shortlisted',
      interview: 'Interview Scheduled',
      interview_scheduled: 'Interview Scheduled',
      interview_completed: 'Interview Completed',
      waiting_feedback: 'Awaiting Feedback',
      selected: 'Selected',
      rejected: 'Rejected by Client',
      rejected_by_candidate: 'Rejected by Candidate',
      duplicate: 'Marked Duplicate',
      position_closed: 'Position Closed',
      hold: 'Position On Hold',
      withdrawn: 'Submission Withdrawn',
      submission_withdrawn: 'Submission Withdrawn',
      offer_released: 'Offer Released',
      offer_accepted: 'Offer Accepted',
      offer_declined: 'Offer Declined',
      joined: 'Joined',
      no_show: 'No Show',
    }
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'submission',
      entityId: id,
      resumeId: prev.rows[0].resume_id,
      eventType: `submission_${newStage}`,
      title: stageTitles[newStage] ?? `Submission → ${newStage.replace(/_/g, ' ')}`,
      detail: `${oldStage} → ${newStage}`,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
    })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: 'submission',
      title: stageTitles[newStage] ?? `Submission updated`,
      body: `${oldStage} → ${newStage}`,
      resumeId: prev.rows[0].resume_id,
      entityType: 'submission',
      entityId: id,
    })
    const sla = new Date(Date.now() + 3 * 86400000)
    await upsertWorkflowInstance({
      tenantId: ctx.tenantId,
      entityType: 'submission',
      entityId: id,
      stage: newStage,
      resumeId: prev.rows[0].resume_id,
      jobPostId: rows[0].job_post_id ?? null,
      slaDueAt: sla,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      detail: `${oldStage} → ${newStage}`,
    })
    const lifeStage = submissionStageToLifecycle(newStage)
    const isTerminalPerson = lifeStage === 'rejected' || lifeStage === 'withdrawn' || lifeStage === 'on_hold'
    const otherOpen = isTerminalPerson
      ? await hasOtherOpenSubmissions({
          tenantId: ctx.tenantId,
          resumeId: prev.rows[0].resume_id,
          exceptSubmissionId: id,
        })
      : false
    if (!(otherOpen && isTerminalPerson)) {
      await advanceFromDomain({
        tenantId: ctx.tenantId,
        resumeId: prev.rows[0].resume_id,
        toStage: lifeStage,
        jobPostId: rows[0].job_post_id ?? prev.rows[0].job_post_id ?? null,
        relatedEntityType: 'submission',
        relatedEntityId: id,
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        reason: `submission_stage:${oldStage}->${newStage}`,
      })
    }
    const actor = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
    }
    const resumeId = prev.rows[0].resume_id
    const jobPostId = (rows[0].job_post_id ?? prev.rows[0].job_post_id) as string | null
    if (submissionStageClosesShare(newStage)) {
      await closeShareForJob({
        ...actor,
        resumeId,
        jobPostId,
        submissionId: id,
        reason: `submission_${newStage}`,
      })
    } else if (submissionStageNeedsInterview(newStage)) {
      await ensureInterviewForSubmission({
        ...actor,
        resumeId,
        jobPostId,
        submissionId: id,
        candidateName: cand.rows[0]?.candidate_name || 'Candidate',
        candidateEmail: cand.rows[0]?.candidate_email,
        notes: `From submission ${rows[0].short_id ?? id}`,
      })
    }
    if (submissionStageNeedsOffer(newStage) && !submissionStageClosesShare(newStage)) {
      await ensureOfferForSelection({
        ...actor,
        resumeId,
        submissionId: id,
        jobPostId,
        candidateName: cand.rows[0]?.candidate_name,
      })
    }
    } catch (e) {
      console.error('[submissions PATCH] side effects (update still saved)', e)
    }
  }

  if (submissionStageNeedsInterview(newStage) && !submissionStageClosesShare(newStage)) {
    try {
      await ensureInterviewForSubmission({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resumeId: prev.rows[0].resume_id,
        jobPostId: (rows[0].job_post_id ?? prev.rows[0].job_post_id) as string | null,
        submissionId: id,
        candidateName: cand.rows[0]?.candidate_name || 'Candidate',
        candidateEmail: cand.rows[0]?.candidate_email,
        notes: `From submission ${rows[0].short_id ?? id}`,
      })
    } catch (e) {
      console.error('[submissions PATCH] ensure interview (update still saved)', e)
    }
  }

  return NextResponse.json({ submission: rows[0] })
}
