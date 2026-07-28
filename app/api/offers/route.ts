import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logDataAccess } from '@/lib/activityLog'
import { normalizeOfferStatus, nextYearSeqId } from '@/lib/recruitmentOs'
import { scheduleJoiningFollowUps } from '@/lib/autoFollowUps'
import { scheduleFullJoiningReminders } from '@/lib/reminderEngine'
import { writeTimeline } from '@/lib/timelineEngine'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import { upsertWorkflowInstance } from '@/lib/workflowEngine'
import { resolveDateFilter, resolveMineScope, deriveDocsStatus, parseHrOps } from '@/lib/opsList'
import { DOCUMENT_SLOTS } from '@/lib/documentStorage'
import { advanceFromDomain, offerStatusToLifecycle } from '@/lib/lifecycle'

const HR_SLOTS = [...DOCUMENT_SLOTS]

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const status = sanitizeText(searchParams.get('status'), 50) ?? ''
  const lifecycle = sanitizeText(searchParams.get('lifecycle'), 50) ?? ''
  const docsStatus = sanitizeText(searchParams.get('docs_status'), 40) ?? ''
  const q = sanitizeText(searchParams.get('q'), 200) ?? ''
  const resumeId = searchParams.get('resume_id') ?? ''
  const dateRange = resolveDateFilter(searchParams)
  const { mine, canToggle } = resolveMineScope(ctx, searchParams.get('mine'))

  const params: unknown[] = [ctx.tenantId]
  let sql = `
    SELECT o.*, r.candidate_name, r.short_id AS candidate_short_id, r.candidate_email,
           r.candidate_phone,
           r.candidate_profile->>'lifecycle_status' AS lifecycle_status,
           COALESCE(
             NULLIF(r.candidate_profile->>'years_experience',''),
             NULLIF(r.candidate_profile->>'total_experience',''),
             NULLIF(r.candidate_profile->>'experience_years','')
           ) AS years_experience,
           NULLIF(r.candidate_profile->>'current_salary','') AS current_salary,
           COALESCE(
             NULLIF(r.candidate_profile->>'expected_salary',''),
             NULLIF(r.candidate_profile->>'salary_expectation','')
           ) AS expected_salary,
           r.candidate_profile->>'client_name' AS profile_client,
           s.client_name AS submission_client,
           s.applying_for AS submission_position,
           jp.title AS job_title,
           COALESCE(jp.company, cl.name) AS job_client_name,
           u.name AS recruiter_name,
           iv.feedback AS interview_feedback,
           iv.status AS interview_status
    FROM offer_cases o
    JOIN resumes r ON r.id = o.resume_id
    LEFT JOIN submissions s ON s.id = o.submission_id
    LEFT JOIN job_posts jp ON jp.id = s.job_post_id
    LEFT JOIN clients cl ON cl.id = jp.client_id
    LEFT JOIN auth_users u ON u.id = o.user_id
    LEFT JOIN LATERAL (
      SELECT feedback, status FROM interviews
      WHERE resume_id = o.resume_id AND tenant_id = o.tenant_id
      ORDER BY scheduled_at DESC NULLS LAST
      LIMIT 1
    ) iv ON TRUE
    WHERE o.tenant_id = $1
  `
  let p = 2
  if (status) {
    sql += ` AND o.status = $${p}`
    params.push(status)
    p++
  }
  if (lifecycle) {
    sql += ` AND (r.candidate_profile->>'lifecycle_status' = $${p} OR r.candidate_profile->>'lifecycle_status' LIKE $${p + 1})`
    params.push(lifecycle, `${lifecycle}%`)
    p += 2
  }
  if (q) {
    sql += ` AND (
      r.candidate_name ILIKE $${p} OR r.candidate_email ILIKE $${p}
      OR r.short_id ILIKE $${p} OR COALESCE(o.short_id,'') ILIKE $${p}
      OR COALESCE(r.candidate_phone,'') ILIKE $${p}
    )`
    params.push(`%${q}%`)
    p++
  }
  if (resumeId && isValidUUID(resumeId)) {
    sql += ` AND o.resume_id = $${p}`
    params.push(resumeId)
    p++
  }
  if (mine) {
    sql += ` AND o.user_id = $${p}`
    params.push(ctx.userId)
    p++
  }
  if (dateRange) {
    sql += ` AND o.updated_at::date >= $${p}::date`
    params.push(dateRange.from)
    p++
    sql += ` AND o.updated_at::date <= $${p}::date`
    params.push(dateRange.to)
    p++
  }
  sql += ' ORDER BY o.updated_at DESC LIMIT 500'

  const { rows } = await pool.query(sql, params)

  await logDataAccess({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.tenantRole,
    accessType: 'offer_list_view',
    resourceType: 'offer_cases',
  })

  const resumeIds = rows.map((o: { resume_id: string }) => o.resume_id).filter(Boolean)
  const slotByResume = new Map<string, Record<string, boolean>>()
  if (resumeIds.length > 0) {
    const { rows: docRows } = await pool.query<{
      resume_id: string
      slot_type: string
      has_file: boolean
    }>(
      `SELECT cd.resume_id, cd.slot_type,
              EXISTS (SELECT 1 FROM document_versions dv WHERE dv.document_id = cd.id) AS has_file
       FROM candidate_documents cd
       WHERE cd.tenant_id = $1 AND cd.resume_id = ANY($2::uuid[])`,
      [ctx.tenantId, resumeIds],
    )
    for (const id of resumeIds) {
      const out: Record<string, boolean> = {}
      for (const slot of HR_SLOTS) out[slot] = false
      slotByResume.set(id, out)
    }
    for (const r of docRows) {
      const out = slotByResume.get(r.resume_id)
      if (out) out[r.slot_type] = r.has_file
    }
  }

  let offers = rows.map((o: {
    resume_id: string
    status: string
    hr_checklist?: Record<string, boolean>
    remarks?: string | null
    salary_breakdown?: unknown
    interview_feedback?: unknown
  }) => {
    const liveSlots = slotByResume.get(o.resume_id) ?? Object.fromEntries(HR_SLOTS.map(s => [s, false]))
    const merged = { ...(o.hr_checklist ?? {}), ...liveSlots }
    const filled = HR_SLOTS.filter(s => merged[s]).length
    const explicit = (() => {
      try {
        const m = (o.remarks ?? '').match(/docs_status:(\w+)/)
        return m?.[1] ?? null
      } catch { return null }
    })()
    const docs_status = deriveDocsStatus(o.status, filled, HR_SLOTS.length, explicit)
    const hr_ops = parseHrOps(o.salary_breakdown, o.remarks)
    let interview_feedback_text: string | null = null
    if (typeof o.interview_feedback === 'string') interview_feedback_text = o.interview_feedback
    else if (o.interview_feedback && typeof o.interview_feedback === 'object') {
      const f = o.interview_feedback as Record<string, unknown>
      interview_feedback_text = typeof f.text === 'string' ? f.text
        : typeof f.notes === 'string' ? f.notes
          : null
    }
    const joined_status = hr_ops.joined_status
      || (o.status === 'joined' ? 'joined' : 'not_joined')
    return {
      ...o,
      hr_checklist: merged,
      doc_slots: liveSlots,
      slots_filled: filled,
      slots_total: HR_SLOTS.length,
      docs_status,
      hr_discussion: hr_ops.hr_discussion ?? 'pending',
      budget_ok: hr_ops.budget_ok ?? false,
      offer_letter_status: hr_ops.offer_letter ?? 'not_started',
      joined_status,
      joined_date: hr_ops.joined_date ?? null,
      interview_feedback_text,
    }
  })

  const docsCounts = { not_started: 0, collecting: 0, with_hr: 0, clearance_done: 0, onboarding: 0 }
  for (const o of offers) {
    docsCounts[o.docs_status as keyof typeof docsCounts]++
  }

  if (docsStatus) {
    offers = offers.filter(o => o.docs_status === docsStatus)
  }

  // Summary counts (pre docs filter for status pills; recompute docs from full set without docs filter)
  const sumParams: unknown[] = [ctx.tenantId]
  let sumSql = `
    SELECT o.status, COUNT(*)::int AS c
    FROM offer_cases o
    JOIN resumes r ON r.id = o.resume_id
    WHERE o.tenant_id = $1`
  let sp = 2
  if (q) {
    sumSql += ` AND (
      r.candidate_name ILIKE $${sp} OR r.candidate_email ILIKE $${sp}
      OR r.short_id ILIKE $${sp} OR COALESCE(o.short_id,'') ILIKE $${sp}
      OR COALESCE(r.candidate_phone,'') ILIKE $${sp}
    )`
    sumParams.push(`%${q}%`)
    sp++
  }
  if (mine) {
    sumSql += ` AND o.user_id = $${sp}`
    sumParams.push(ctx.userId)
    sp++
  }
  if (dateRange) {
    sumSql += ` AND o.updated_at::date >= $${sp}::date`
    sumParams.push(dateRange.from)
    sp++
    sumSql += ` AND o.updated_at::date <= $${sp}::date`
    sumParams.push(dateRange.to)
    sp++
  }
  sumSql += ' GROUP BY o.status'
  const { rows: statusCounts } = await pool.query<{ status: string; c: number }>(sumSql, sumParams)
  const byStatus: Record<string, number> = {}
  let all = 0
  for (const row of statusCounts) {
    byStatus[row.status] = row.c
    all += row.c
  }

  return NextResponse.json({
    offers,
    mine,
    can_toggle_mine: canToggle,
    summary: {
      all,
      by_status: byStatus,
      docs: docsCounts,
    },
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const resume_id = body.resume_id as string
  if (!isValidUUID(resume_id)) return NextResponse.json({ error: 'Invalid resume_id' }, { status: 400 })

  const shortId = await nextYearSeqId(pool, { tenantId: ctx.tenantId, table: 'offer_cases', prefix: 'OFF' })

  let rows: { id: string; resume_id: string; status: string; short_id?: string; approval_status?: string }[]
  try {
    const inserted = await pool.query(
      `INSERT INTO offer_cases
         (tenant_id, resume_id, submission_id, user_id, status, offer_salary, expected_joining,
          employment_type, hr_checklist, notes, short_id, salary_breakdown, benefits, remarks,
          offer_expiry, country_code, offer_draft)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        ctx.tenantId, resume_id,
        body.submission_id && isValidUUID(body.submission_id) ? body.submission_id : null,
        ctx.userId,
        sanitizeText(body.status, 50) ? normalizeOfferStatus(sanitizeText(body.status, 50)!) : 'selected',
        sanitizeText(body.offer_salary, 120),
        body.expected_joining || null,
        sanitizeText(body.employment_type, 50),
        JSON.stringify(body.hr_checklist ?? {}),
        sanitizeText(body.notes, 5000),
        shortId,
        JSON.stringify(body.salary_breakdown ?? {}),
        sanitizeText(body.benefits, 5000),
        sanitizeText(body.remarks, 5000),
        body.offer_expiry || null,
        sanitizeText(body.country_code, 10) ?? 'MY',
        body.offer_draft ?? null,
      ],
    )
    rows = inserted.rows
  } catch {
    const inserted = await pool.query(
      `INSERT INTO offer_cases
         (tenant_id, resume_id, submission_id, user_id, status, offer_salary, expected_joining, employment_type, hr_checklist, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        ctx.tenantId, resume_id,
        body.submission_id && isValidUUID(body.submission_id) ? body.submission_id : null,
        ctx.userId,
        sanitizeText(body.status, 50) ? normalizeOfferStatus(sanitizeText(body.status, 50)!) : 'selected',
        sanitizeText(body.offer_salary, 120),
        body.expected_joining || null,
        sanitizeText(body.employment_type, 50),
        JSON.stringify(body.hr_checklist ?? {}),
        sanitizeText(body.notes, 5000),
      ],
    )
    rows = inserted.rows
  }

  await writeTimeline({
    tenantId: ctx.tenantId,
    entityType: 'offer',
    entityId: rows[0].id,
    resumeId: resume_id,
    eventType: 'offer_created',
    title: rows[0].status === 'offer_released' ? 'Offer Released' : 'Offer Draft',
    detail: rows[0].short_id ?? shortId,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
  })

  await logAudit({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    tenantId: ctx.tenantId,
    action: 'offer_created',
    resourceType: 'offer',
    resourceId: rows[0].id,
    resumeId: resume_id,
    module: 'offers',
    newValue: rows[0].status,
  })

  await createNotification({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    category: 'offer',
    title: `Offer created — ${rows[0].short_id ?? shortId}`,
    body: `Status: ${rows[0].status}`,
    resumeId: resume_id,
    entityType: 'offer',
    entityId: rows[0].id,
  })

  if (body.expected_joining) {
    const cand = await pool.query<{ candidate_name: string }>(
      'SELECT candidate_name FROM resumes WHERE id = $1',
      [resume_id],
    )
    const joinOpts = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resumeId: resume_id,
      offerCaseId: rows[0].id,
      joiningDate: String(body.expected_joining),
      candidateName: cand.rows[0]?.candidate_name,
    }
    await scheduleJoiningFollowUps(joinOpts)
    await scheduleFullJoiningReminders(joinOpts)
  }

  let approvalStatus = rows[0].approval_status as string | undefined
  if (rows[0].status === 'offer_released' && approvalStatus !== 'approved') {
    if (!approvalStatus || approvalStatus === 'none') {
      try {
        await pool.query(
          `UPDATE offer_cases SET approval_status = 'pending', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [rows[0].id, ctx.tenantId],
        )
        approvalStatus = 'pending'
        rows[0].approval_status = 'pending'
      } catch { /* ignore */ }
    }
  }

  await upsertWorkflowInstance({
    tenantId: ctx.tenantId,
    entityType: 'offer',
    entityId: rows[0].id,
    stage: rows[0].status,
    resumeId: resume_id,
    approvalStatus: approvalStatus ?? 'none',
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
  })

  await advanceFromDomain({
    tenantId: ctx.tenantId,
    resumeId: resume_id,
    toStage: offerStatusToLifecycle(rows[0].status),
    relatedEntityType: 'offer',
    relatedEntityId: rows[0].id,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    reason: `offer_created:${rows[0].status}`,
  })

  return NextResponse.json({ offer: rows[0] }, { status: 201 })
}
