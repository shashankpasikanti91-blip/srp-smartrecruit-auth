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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const prev = await pool.query<{ status: string; resume_id: string; approval_status: string | null }>(
    'SELECT status, resume_id, approval_status FROM offer_cases WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
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

  vals.push(id, ctx.tenantId)
  const { rows } = await pool.query(
    `UPDATE offer_cases SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    vals
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = rows[0].status as string
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

  return NextResponse.json({ offer: rows[0] })
}
