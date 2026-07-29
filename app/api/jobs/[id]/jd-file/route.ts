import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import {
  saveJobJdOriginalFile,
  readJobJdOriginalFile,
  validateUpload,
  mimeForExt,
  extFromFilename,
} from '@/lib/documentStorage'
import path from 'path'

/** POST — upload / replace original JD binary for a job. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireTenant(req, 'jobs.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const own = await pool.query(
    'SELECT id FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId],
  )
  if (!own.rows[0]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
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

  const validation = validateUpload(file)
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 })
  }

  try {
    const saved = await saveJobJdOriginalFile(ctx.tenantId, id, file)
    await pool.query(
      `UPDATE job_posts
       SET jd_original_path = $1,
           jd_original_name = $2,
           jd_original_mime = $3,
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [saved.relative, file.name.slice(0, 255), saved.mime, id, ctx.tenantId],
    )
    return NextResponse.json({
      ok: true,
      jd_original_path: saved.relative,
      jd_original_name: file.name,
      jd_original_mime: saved.mime,
    })
  } catch (e) {
    console.error('[jd-file POST]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not save JD file' },
      { status: 500 },
    )
  }
}

/** HEAD — check whether original JD file exists on disk. */
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireTenant(req, 'jobs.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return new NextResponse(null, { status: 400 })

  const { rows } = await pool.query<{ jd_original_path: string | null }>(
    'SELECT jd_original_path FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId],
  )
  if (!rows[0]?.jd_original_path) return new NextResponse(null, { status: 404 })
  try {
    await readJobJdOriginalFile(rows[0].jd_original_path)
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

/** GET — download or inline-preview original JD file. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireTenant(req, 'jobs.read')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { rows } = await pool.query<{
    jd_original_path: string | null
    jd_original_name: string | null
    jd_original_mime: string | null
  }>(
    `SELECT jd_original_path, jd_original_name, jd_original_mime
     FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, ctx.tenantId],
  )
  const row = rows[0]
  if (!row?.jd_original_path) {
    return NextResponse.json({ error: 'No original JD file stored for this job' }, { status: 404 })
  }

  try {
    const buf = await readJobJdOriginalFile(row.jd_original_path)
    const ext = extFromFilename(row.jd_original_name || row.jd_original_path) || path.extname(row.jd_original_path)
    const mime = row.jd_original_mime || mimeForExt(ext)
    const inline = req.nextUrl.searchParams.get('inline') === '1'
    const filename = row.jd_original_name || `jd-${id.slice(0, 8)}${ext}`
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File missing' }, { status: 404 })
  }
}
