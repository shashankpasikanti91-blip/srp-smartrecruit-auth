import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logDataAccess } from '@/lib/activityLog'

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
  const params: unknown[] = [ctx.tenantId]
  let sql = `
    SELECT o.*, r.candidate_name, r.short_id AS candidate_short_id, r.candidate_email,
           r.candidate_profile->>'lifecycle_status' AS lifecycle_status
    FROM offer_cases o
    JOIN resumes r ON r.id = o.resume_id
    WHERE o.tenant_id = $1
  `
  if (status) {
    sql += ' AND o.status = $2'
    params.push(status)
  }
  if (lifecycle) {
    const idx = params.length + 1
    sql += ` AND (r.candidate_profile->>'lifecycle_status' = $${idx} OR r.candidate_profile->>'lifecycle_status' LIKE $${idx + 1})`
    params.push(lifecycle, `${lifecycle}%`)
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

  const { rows } = await pool.query(
    `INSERT INTO offer_cases
       (tenant_id, resume_id, submission_id, user_id, status, offer_salary, expected_joining, employment_type, hr_checklist, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      ctx.tenantId, resume_id,
      body.submission_id && isValidUUID(body.submission_id) ? body.submission_id : null,
      ctx.userId,
      sanitizeText(body.status, 50) ?? 'offer_released',
      sanitizeText(body.offer_salary, 120),
      body.expected_joining || null,
      sanitizeText(body.employment_type, 50),
      JSON.stringify(body.hr_checklist ?? {}),
      sanitizeText(body.notes, 5000),
    ]
  )
  return NextResponse.json({ offer: rows[0] }, { status: 201 })
}
