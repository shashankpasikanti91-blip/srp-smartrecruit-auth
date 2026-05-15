import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import path from 'path'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.txt'])

function uploadsRoot() {
  return path.join(process.cwd(), 'uploads', 'candidate-resumes')
}

function extFromFilename(name: string): string {
  const lower = (name || '').toLowerCase()
  for (const e of ALLOWED_EXT) {
    if (lower.endsWith(e)) return e
  }
  return ''
}

function mimeForExt(ext: string): string {
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.doc') return 'application/msword'
  return 'text/plain; charset=utf-8'
}

/** POST — attach or replace original resume binary for this candidate (tenant-scoped). */
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

  const own = await pool.query<{ id: string; resume_original_path: string | null }>(
    'SELECT id, resume_original_path FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
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

  const relative = path.join(ctx.tenantId, `${id}${ext}`)
  const absDir = path.join(uploadsRoot(), ctx.tenantId)
  const absFile = path.join(uploadsRoot(), relative)

  try {
    await mkdir(absDir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(absFile, buf)

    const oldPath = own.rows[0].resume_original_path
    if (oldPath && oldPath !== relative) {
      try {
        const oldAbs = path.join(uploadsRoot(), oldPath)
        if (oldAbs.startsWith(uploadsRoot())) await unlink(oldAbs)
      } catch {
        /* ignore missing old file */
      }
    }

    await pool.query(
      `UPDATE resumes SET resume_original_path = $1,
            file_name = COALESCE($2, file_name),
            file_size_bytes = $3,
            updated_at = NOW()
          WHERE id = $4 AND tenant_id = $5`,
      [relative, file.name.slice(0, 255), file.size, id, ctx.tenantId]
    )
  } catch (e) {
    console.error('[resume-file POST]', e)
    return NextResponse.json({ error: 'Could not save file' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resume_original_path: relative })
}

/** GET — stream stored original file (auth + tenant). */
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

  const { rows } = await pool.query<{ resume_original_path: string | null }>(
    'SELECT resume_original_path FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  const rel = rows[0]?.resume_original_path
  if (!rel) {
    return NextResponse.json({ error: 'No original file on record' }, { status: 404 })
  }

  const normalized = path.normalize(rel)
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 500 })
  }

  const absFile = path.join(uploadsRoot(), normalized)
  const root = uploadsRoot()
  if (!absFile.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 500 })
  }

  let buf: Buffer
  try {
    buf = await readFile(absFile)
  } catch {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  }

  const ext = path.extname(absFile).toLowerCase()
  const mime = mimeForExt(ext)
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const disposition = inline ? 'inline' : `attachment; filename="${path.basename(absFile)}"`

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
