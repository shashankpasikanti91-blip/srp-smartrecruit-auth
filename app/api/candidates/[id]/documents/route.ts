import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import {
  DOCUMENT_SLOTS,
  validateUpload,
  saveCandidateDocumentFile,
  mimeForExt,
  extFromFilename,
  isValidDocumentSlot,
  slotLabel,
  type DocumentSlot,
} from '@/lib/documentStorage'
import { getDocumentChecklist } from '@/lib/recruitmentOs'
import { resolveChecklistCountry, resolveEmploymentType } from '@/lib/dossierChecks'
import { logAudit } from '@/lib/audit'

async function assertCandidate(tenantId: string, resumeId: string) {
  const { rows } = await pool.query<{ id: string; short_id: string }>(
    'SELECT id, short_id FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [resumeId, tenantId]
  )
  return rows[0] ?? null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const cand = await assertCandidate(ctx.tenantId, id)
  if (!cand) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const profileRes = await pool.query<{ candidate_profile: Record<string, unknown> | null; nationality_hint: string | null }>(
    `SELECT candidate_profile,
            COALESCE(candidate_profile->>'nationality', candidate_profile->>'work_country', '') AS nationality_hint
     FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, ctx.tenantId]
  )
  const profile = profileRes.rows[0]?.candidate_profile ?? {}
  const country = resolveChecklistCountry(profileRes.rows[0]?.nationality_hint)
  const employmentType = resolveEmploymentType(profile)
  const checklist = getDocumentChecklist(country, employmentType)
  const checklistKeys = checklist.map(c => c.key)
  // Always include core slots + country checklist (+ any already-uploaded slots)
  const displaySlots = Array.from(new Set([
    'resume',
    ...checklistKeys.filter(k => isValidDocumentSlot(k) || DOCUMENT_SLOTS.includes(k as DocumentSlot)),
    ...DOCUMENT_SLOTS.slice(0, 7),
  ]))

  const { rows } = await pool.query(
    `SELECT cd.id, cd.slot_type, cd.label, cd.created_at, cd.updated_at,
            cd.verification_status, cd.verified_by, cd.verified_at, cd.expiry_date,
            cd.country_code, cd.category, cd.short_id, cd.status AS doc_status,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', dv.id,
                  'version_no', dv.version_no,
                  'file_name', dv.file_name,
                  'mime_type', dv.mime_type,
                  'file_size_bytes', dv.file_size_bytes,
                  'uploaded_by', dv.uploaded_by,
                  'notes', dv.notes,
                  'created_at', dv.created_at
                ) ORDER BY dv.version_no DESC
              ) FILTER (WHERE dv.id IS NOT NULL),
              '[]'::json
            ) AS versions
     FROM candidate_documents cd
     LEFT JOIN document_versions dv ON dv.document_id = cd.id
     WHERE cd.tenant_id = $1 AND cd.resume_id = $2
     GROUP BY cd.id
     ORDER BY cd.updated_at DESC NULLS LAST, cd.slot_type`,
    [ctx.tenantId, id]
  )

  for (const r of rows as { slot_type: string }[]) {
    if (!displaySlots.includes(r.slot_type)) displaySlots.push(r.slot_type)
  }

  const requiredKeys = new Set(checklist.filter(c => c.required).map(c => c.key))
  const slots = displaySlots.map(slot => {
    const row = rows.find((r: { slot_type: string }) => r.slot_type === slot)
    const label = slotLabel(slot)
    const checklistItem = checklist.find(c => c.key === slot)
    if (row) {
      return {
        ...row,
        slot_label: label,
        required: requiredKeys.has(slot) || !!checklistItem?.required,
        country,
      }
    }
    return {
      id: null,
      slot_type: slot,
      slot_label: label,
      label,
      versions: [],
      empty: true,
      required: requiredKeys.has(slot) || !!checklistItem?.required,
      country,
    }
  })

  return NextResponse.json({ documents: slots, country, employment_type: employmentType, checklist })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const cand = await assertCandidate(ctx.tenantId, id)
  if (!cand) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let file: File | null = null
  let slotType = 'other'
  let notes = ''
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
    slotType = String(form.get('slot_type') ?? 'other')
    notes = String(form.get('notes') ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const err = validateUpload(file)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  if (!isValidDocumentSlot(slotType)) {
    return NextResponse.json({ error: 'Invalid slot_type' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let docRow = await client.query<{ id: string }>(
      `SELECT id FROM candidate_documents
       WHERE tenant_id = $1 AND resume_id = $2 AND slot_type = $3 LIMIT 1`,
      [ctx.tenantId, id, slotType]
    )

    let documentId: string
    if (!docRow.rows[0]) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO candidate_documents (tenant_id, resume_id, slot_type, label)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [ctx.tenantId, id, slotType, slotLabel(slotType)]
      )
      documentId = ins.rows[0].id
    } else {
      documentId = docRow.rows[0].id
    }

    const verRes = await client.query<{ max: number | null }>(
      'SELECT MAX(version_no) AS max FROM document_versions WHERE document_id = $1',
      [documentId]
    )
    const versionNo = (verRes.rows[0]?.max ?? 0) + 1
    const { relative, ext } = await saveCandidateDocumentFile(
      ctx.tenantId, id, documentId, versionNo, file
    )

    const dv = await client.query(
      `INSERT INTO document_versions
         (document_id, tenant_id, version_no, storage_path, file_name, mime_type, file_size_bytes, uploaded_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        documentId, ctx.tenantId, versionNo, relative, file.name.slice(0, 255),
        mimeForExt(ext), file.size, ctx.userId, notes.slice(0, 500) || null,
      ]
    )

    await client.query(
      `UPDATE candidate_documents SET
         updated_at = NOW(),
         verification_status = 'pending_verification',
         verified_by = NULL,
         verified_at = NULL
       WHERE id = $1`,
      [documentId]
    )

    if (slotType === 'resume') {
      await client.query(
        `UPDATE resumes SET resume_original_path = $1, file_name = $2, file_size_bytes = $3, updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [relative, file.name.slice(0, 255), file.size, id, ctx.tenantId]
      )
    }

    await client.query('COMMIT')

    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: versionNo === 1 ? 'document_uploaded' : 'document_replaced',
      resourceType: 'candidate',
      resourceId: cand.short_id,
      details: { slot_type: slotType, version_no: versionNo, file_name: file.name },
      tenantId: ctx.tenantId,
    })

    return NextResponse.json({ document_id: documentId, version: dv.rows[0] }, { status: 201 })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[documents POST]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  } finally {
    client.release()
  }
}
