import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { normalizeOfferStatus } from '@/lib/recruitmentOs'
import { scheduleJoiningFollowUps } from '@/lib/autoFollowUps'
import { scheduleFullJoiningReminders } from '@/lib/reminderEngine'
import { writeTimeline } from '@/lib/timelineEngine'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import { upsertWorkflowInstance } from '@/lib/workflowEngine'
import { runCollaborativeChain } from '@/lib/agentCollaboration'
import { mergeHrOps } from '@/lib/opsList'
import { advanceFromDomain, hasOtherOpenSubmissions, offerStatusToLifecycle } from '@/lib/lifecycle'
import { closeShareForJob } from '@/lib/lifecycleCascade'
import { resolveDocumentChecklist } from '@/lib/resolveDocumentChecklist'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let prev: { rows: { status: string; resume_id: string; approval_status: string | null; submission_id?: string | null }[] }
  try {
    prev = await pool.query(
      'SELECT status, resume_id, approval_status, submission_id FROM offer_cases WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId],
    )
  } catch {
    prev = await pool.query(
      'SELECT status, resume_id, approval_status FROM offer_cases WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId],
    )
  }
  if (!prev.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const oldStatus = prev.rows[0].status

  const body = await req.json()
  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1

  const pendingStatus = body.status !== undefined
    ? normalizeOfferStatus(sanitizeText(body.status, 50) ?? oldStatus)
    : oldStatus
  const willRelease = pendingStatus === 'offer_released'
  const currentApproval = body.approval_status !== undefined
    ? sanitizeText(body.approval_status, 40)
    : prev.rows[0].approval_status
  const approvalAlreadyInSets = body.approval_status !== undefined

  if (body.status !== undefined) {
    sets.unshift(`status = $${i++}`)
    vals.push(pendingStatus)
  }

  if (willRelease && currentApproval !== 'approved' && !approvalAlreadyInSets) {
    if (!currentApproval || currentApproval === 'none') {
      sets.unshift(`approval_status = $${i++}`)
      vals.push('pending')
    }
  }
  if (body.offer_salary !== undefined) {
    sets.unshift(`offer_salary = $${i++}`)
    vals.push(sanitizeText(body.offer_salary, 120))
  }
  if (body.expected_joining !== undefined) {
    sets.unshift(`expected_joining = $${i++}`)
    vals.push(body.expected_joining || null)
  }
  if (body.hr_checklist !== undefined) {
    sets.unshift(`hr_checklist = $${i++}::jsonb`)
    vals.push(JSON.stringify(body.hr_checklist))
  }
  if (body.notes !== undefined) {
    sets.unshift(`notes = $${i++}`)
    vals.push(sanitizeText(body.notes, 5000))
  }
  if (body.benefits !== undefined) {
    sets.unshift(`benefits = $${i++}`)
    vals.push(sanitizeText(body.benefits, 5000))
  }
  if (body.remarks !== undefined) {
    sets.unshift(`remarks = $${i++}`)
    vals.push(sanitizeText(body.remarks, 5000))
  }
  if (body.offer_expiry !== undefined) {
    sets.unshift(`offer_expiry = $${i++}`)
    vals.push(body.offer_expiry || null)
  }
  if (body.salary_breakdown !== undefined) {
    sets.unshift(`salary_breakdown = $${i++}::jsonb`)
    vals.push(JSON.stringify(body.salary_breakdown))
  }
  if (body.offer_draft !== undefined) {
    sets.unshift(`offer_draft = $${i++}`)
    vals.push(body.offer_draft)
  }
  if (body.signature_status !== undefined) {
    sets.unshift(`signature_status = $${i++}`)
    vals.push(sanitizeText(body.signature_status, 40))
  }
  if (body.counter_offer_notes !== undefined) {
    sets.unshift(`counter_offer_notes = $${i++}`)
    vals.push(sanitizeText(body.counter_offer_notes, 5000))
  }
  if (body.approval_status !== undefined) {
    sets.unshift(`approval_status = $${i++}`)
    vals.push(sanitizeText(body.approval_status, 40))
  }
  if (body.employment_type !== undefined || body.country_code !== undefined) {
    const cur = await pool.query<{
      employment_type: string | null
      country_code: string | null
      hr_checklist: Record<string, boolean> | null
    }>(
      `SELECT employment_type, country_code, hr_checklist FROM offer_cases WHERE id = $1 AND tenant_id = $2`,
      [id, ctx.tenantId],
    )
    const emp = (body.employment_type ?? cur.rows[0]?.employment_type) === 'foreign' ? 'foreign' : 'local'
    const country = String(body.country_code ?? cur.rows[0]?.country_code ?? 'MY').toUpperCase()
    if (body.employment_type !== undefined) {
      sets.unshift(`employment_type = $${i++}`)
      vals.push(emp)
    }
    if (body.country_code !== undefined) {
      sets.unshift(`country_code = $${i++}`)
      vals.push(sanitizeText(body.country_code, 10)?.toUpperCase() ?? country)
    }
    try {
      const { items } = await resolveDocumentChecklist(ctx.tenantId, country, emp)
      const prevCheck = (cur.rows[0]?.hr_checklist && typeof cur.rows[0].hr_checklist === 'object')
        ? cur.rows[0].hr_checklist as Record<string, boolean>
        : {}
      const next = Object.fromEntries(items.map(it => [it.key, Boolean(prevCheck[it.key])]))
      sets.unshift(`hr_checklist = $${i++}::jsonb`)
      vals.push(JSON.stringify(next))
    } catch { /* ignore rebuild */ }
  }
  if (body.docs_status !== undefined) {
    const ds = sanitizeText(body.docs_status, 40) ?? 'not_started'
    // Persist as tagged remark so we don't need a migration; merge with existing remarks below
    const prevRemarks = await pool.query<{ remarks: string | null }>(
      'SELECT remarks FROM offer_cases WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId],
    )
    const raw = prevRemarks.rows[0]?.remarks ?? ''
    const cleaned = raw.replace(/\s*docs_status:\w+/g, '').trim()
    const nextRemarks = `${cleaned}${cleaned ? ' ' : ''}docs_status:${ds}`.trim()
    sets.unshift(`remarks = $${i++}`)
    vals.push(nextRemarks)
    // Map docs status to a sensible offer stage when still early
    if (ds === 'collecting' && !body.status) {
      sets.unshift(`status = $${i++}`)
      vals.push('document_collection')
    } else if (ds === 'with_hr' && !body.status) {
      sets.unshift(`status = $${i++}`)
      vals.push('document_verification')
    } else if ((ds === 'clearance_done' || ds === 'onboarding') && !body.status) {
      sets.unshift(`status = $${i++}`)
      vals.push(ds === 'onboarding' ? 'onboarding' : 'offer_draft')
    } else if (ds === 'not_started' && !body.status) {
      sets.unshift(`status = $${i++}`)
      vals.push('selected')
    }
  }

  const hrPatchKeys = ['hr_discussion', 'budget_ok', 'offer_letter', 'joined_status', 'joined_date'] as const
  const hasHrPatch = hrPatchKeys.some(k => body[k] !== undefined) || body.offer_letter_status !== undefined
  if (hasHrPatch) {
    const prev = await pool.query<{ salary_breakdown: unknown; status: string }>(
      'SELECT salary_breakdown, status FROM offer_cases WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId],
    )
    const patch: Record<string, unknown> = {}
    if (body.hr_discussion !== undefined) patch.hr_discussion = sanitizeText(body.hr_discussion, 60)
    if (body.budget_ok !== undefined) patch.budget_ok = Boolean(body.budget_ok)
    if (body.offer_letter !== undefined || body.offer_letter_status !== undefined) {
      patch.offer_letter = sanitizeText(body.offer_letter ?? body.offer_letter_status, 60)
    }
    if (body.joined_status !== undefined) patch.joined_status = sanitizeText(body.joined_status, 40)
    if (body.joined_date !== undefined) patch.joined_date = body.joined_date || null
    const next = mergeHrOps(prev.rows[0]?.salary_breakdown, patch)
    sets.unshift(`salary_breakdown = $${i++}::jsonb`)
    vals.push(JSON.stringify(next))
    if (body.joined_status === 'joined' && !body.status) {
      sets.unshift(`status = $${i++}`)
      vals.push('joined')
    }
  }

  vals.push(id, ctx.tenantId)
  const { rows } = await pool.query(
    `UPDATE offer_cases SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    vals
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = rows[0].status as string
  try {
  if (body.status !== undefined && newStatus !== oldStatus) {
    try {
      await pool.query(
        `INSERT INTO offer_history (offer_case_id, tenant_id, user_id, old_status, new_status, details)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, ctx.tenantId, ctx.userId, oldStatus, newStatus, JSON.stringify({ offer_salary: rows[0].offer_salary })]
      )
    } catch { /* ignore */ }

    const statusTitles: Record<string, string> = {
      offer_draft: 'Offer Draft',
      offer_released: 'Offer Released',
      offer_accepted: 'Offer Accepted',
      offer_rejected: 'Offer Declined',
      joining_confirmed: 'Joining Confirmed',
      joined: 'Joined',
      dropped: 'Dropped',
      salary_negotiation: 'Counter Offer',
    }
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'offer',
      entityId: id,
      resumeId: prev.rows[0].resume_id,
      eventType: `offer_${newStatus}`,
      title: statusTitles[newStatus] ?? `Offer ${newStatus.replace(/_/g, ' ')}`,
      detail: `${oldStatus} → ${newStatus}`,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
    })
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      tenantId: ctx.tenantId,
      action: 'offer_status_changed',
      resourceType: 'offer',
      resourceId: id,
      resumeId: prev.rows[0].resume_id,
      module: 'offers',
      oldValue: oldStatus,
      newValue: newStatus,
      reason: sanitizeText(body.reason, 500),
    })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: 'offer',
      title: statusTitles[newStatus] ?? `Offer updated`,
      body: `${oldStatus} → ${newStatus}`,
      resumeId: prev.rows[0].resume_id,
      entityType: 'offer',
      entityId: id,
    })

    if (['offer_accepted', 'joining_confirmed', 'selected'].includes(newStatus)) {
      const cand = await pool.query<{ candidate_name: string }>(
        'SELECT candidate_name FROM resumes WHERE id = $1',
        [prev.rows[0].resume_id],
      )
      await runCollaborativeChain({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        triggerEvent: newStatus === 'offer_accepted' ? 'offer_accepted' : 'candidate_selected',
        resumeId: prev.rows[0].resume_id,
        entityType: 'offer',
        entityId: id,
        candidateName: cand.rows[0]?.candidate_name,
      })
    }
  }

  if (body.expected_joining) {
    const cand = await pool.query<{ candidate_name: string }>(
      'SELECT candidate_name FROM resumes WHERE id = $1',
      [prev.rows[0].resume_id],
    )
    const joinOpts = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resumeId: prev.rows[0].resume_id,
      offerCaseId: id,
      joiningDate: String(body.expected_joining),
      candidateName: cand.rows[0]?.candidate_name,
    }
    await scheduleJoiningFollowUps(joinOpts)
    await scheduleFullJoiningReminders(joinOpts)
  }

  await upsertWorkflowInstance({
    tenantId: ctx.tenantId,
    entityType: 'offer',
    entityId: id,
    stage: rows[0].status,
    resumeId: prev.rows[0].resume_id,
    approvalStatus: rows[0].approval_status ?? 'none',
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    detail: body.status !== undefined && newStatus !== oldStatus
      ? `${oldStatus} → ${newStatus}`
      : null,
  })

  if (body.status !== undefined && newStatus !== oldStatus) {
    if (['offer_rejected', 'cancelled', 'dropped'].includes(newStatus)) {
      try {
        if (prev.rows[0].submission_id) {
          await pool.query(
            `UPDATE submissions SET stage = 'rejected_by_candidate', updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2
               AND stage NOT IN ('joined')`,
            [prev.rows[0].submission_id, ctx.tenantId],
          )
        }
      } catch { /* ignore */ }
      await closeShareForJob({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resumeId: prev.rows[0].resume_id,
        submissionId: prev.rows[0].submission_id,
        reason: `offer_${newStatus}`,
      })
    }
    const nextLife = offerStatusToLifecycle(newStatus)
    const skipPersonReject = (nextLife === 'rejected' || nextLife === 'withdrawn')
      && await hasOtherOpenSubmissions({
        tenantId: ctx.tenantId,
        resumeId: prev.rows[0].resume_id,
        exceptSubmissionId: prev.rows[0].submission_id,
      })
    if (!skipPersonReject) {
      await advanceFromDomain({
        tenantId: ctx.tenantId,
        resumeId: prev.rows[0].resume_id,
        toStage: nextLife,
        relatedEntityType: 'offer',
        relatedEntityId: id,
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        reason: `offer_status:${oldStatus}->${newStatus}`,
      })
    }
  } else if (body.joined_status === 'joined') {
    await advanceFromDomain({
      tenantId: ctx.tenantId,
      resumeId: prev.rows[0].resume_id,
      toStage: 'joined',
      relatedEntityType: 'offer',
      relatedEntityId: id,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      reason: 'joined_status:joined',
    })
  }
  } catch (e) {
    console.error('[offers PATCH] side effects (update still saved)', e)
  }

  return NextResponse.json({ offer: rows[0] })
}
