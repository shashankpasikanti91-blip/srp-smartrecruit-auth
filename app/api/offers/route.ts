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

const HR_SLOTS = ['resume', 'passport', 'visa', 'certificate', 'offer_letter']

async function docSlotsForResume(tenantId: string, resumeId: string): Promise<Record<string, boolean>> {
  const { rows } = await pool.query<{ slot_type: string; has_file: boolean }>(
    `SELECT cd.slot_type,
            EXISTS (SELECT 1 FROM document_versions dv WHERE dv.document_id = cd.id) AS has_file
     FROM candidate_documents cd
     WHERE cd.tenant_id = $1 AND cd.resume_id = $2`,
    [tenantId, resumeId]
  )
  const out: Record<string, boolean> = {}
  for (const slot of HR_SLOTS) out[slot] = false
  for (const r of rows) out[r.slot_type] = r.has_file
  return out
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const status = sanitizeText(new URL(req.url).searchParams.get('status'), 50) ?? ''
  const lifecycle = sanitizeText(new URL(req.url).searchParams.get('lifecycle'), 50) ?? ''
  const resumeId = new URL(req.url).searchParams.get('resume_id') ?? ''
  const params: unknown[] = [ctx.tenantId]
  let sql = `
    SELECT o.*, r.candidate_name, r.short_id AS candidate_short_id, r.candidate_email,
           r.candidate_profile->>'lifecycle_status' AS lifecycle_status
    FROM offer_cases o
    JOIN resumes r ON r.id = o.resume_id
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
  if (resumeId && isValidUUID(resumeId)) {
    sql += ` AND o.resume_id = $${p}`
    params.push(resumeId)
  }
  sql += ' ORDER BY o.updated_at DESC LIMIT 200'

  const { rows } = await pool.query(sql, params)

  await logDataAccess({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.tenantRole,
    accessType: 'offer_list_view',
    resourceType: 'offer_cases',
  })

  const offers = await Promise.all(rows.map(async (o: { resume_id: string; hr_checklist?: Record<string, boolean> }) => {
    const liveSlots = await docSlotsForResume(ctx.tenantId, o.resume_id)
    const merged = { ...(o.hr_checklist ?? {}), ...liveSlots }
    return { ...o, hr_checklist: merged, doc_slots: liveSlots }
  }))

  return NextResponse.json({ offers })
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
      ]
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
      ]
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
          [rows[0].id, ctx.tenantId]
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

  return NextResponse.json({ offer: rows[0] }, { status: 201 })
}
