import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logDataAccess } from '@/lib/activityLog'
import { syncResumeToDocumentSlot } from '@/lib/resumeDocumentSync'
import { readStoredFile, mimeForExt } from '@/lib/documentStorage'
import path from 'path'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.txt'])

function extFromFilename(name: string): string {
  const lower = (name || '').toLowerCase()
  for (const e of ALLOWED_EXT) {
    if (lower.endsWith(e)) return e
  }
  return ''
}

/** POST — attach or replace resume; syncs to candidate_documents resume slot. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
  }

  const own = await pool.query<{ id: string; short_id: string; resume_original_path: string | null }>(
    'SELECT id, short_id, resume_original_path FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  if (!own.rows[0]) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 })
  }

  const ext = extFromFilename(file.name)
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported type — use PDF, DOCX, DOC, or TXT' }, { status: 400 })
  }

  try {
    await syncResumeToDocumentSlot({
      tenantId: ctx.tenantId,
      resumeId: id,
      shortId: own.rows[0].short_id,
      userId: ctx.userId,
      storagePath: '',
      fileName: file.name,
      fileSize: file.size,
      file,
    })

    const hadPrior = !!own.rows[0].resume_original_path
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: hadPrior ? 'resume_replaced' : 'document_uploaded',
      resourceType: 'candidate',
      resourceId: own.rows[0].short_id,
      details: { slot_type: 'resume', file_name: file.name },
      tenantId: ctx.tenantId,
    })
  } catch (e) {
    console.error('[resume-file POST]', e)
    return NextResponse.json({ error: 'Could not save file' }, { status: 500 })
  }

  const { rows } = await pool.query<{ resume_original_path: string | null }>(
    'SELECT resume_original_path FROM resumes WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
  return NextResponse.json({ ok: true, resume_original_path: rows[0]?.resume_original_path })
}

/** HEAD — check whether the resume file exists without streaming it. */
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return new NextResponse(null, { status: 400 })
  }

  const { rows } = await pool.query<{ resume_original_path: string | null }>(
    'SELECT resume_original_path FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  const rel = rows[0]?.resume_original_path
  if (!rel) return new NextResponse(null, { status: 404 })

  try {
    await readStoredFile(rel)
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

/** GET — stream stored resume (auth + tenant). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
  }

  const { rows } = await pool.query<{ resume_original_path: string | null; short_id: string }>(
    'SELECT resume_original_path, short_id FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  const rel = rows[0]?.resume_original_path
  if (!rel) {
    return NextResponse.json({ error: 'No original file on record' }, { status: 404 })
  }

  logDataAccess({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.tenantRole,
    accessType: 'resume_download',
    resourceType: 'candidate',
    resourceId: rows[0].short_id,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  let buf: Buffer
  try {
    buf = await readStoredFile(rel)
  } catch {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  }

  const ext = path.extname(rel).toLowerCase()
  const mime = mimeForExt(ext)
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const safeName = path.basename(rel).replace(/"/g, '')
  const disposition = inline ? `inline; filename="${safeName}"` : `attachment; filename="${safeName}"`

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
