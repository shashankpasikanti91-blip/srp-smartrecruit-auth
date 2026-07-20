import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { readStoredFile, mimeForExt } from '@/lib/documentStorage'
import path from 'path'
import { logAudit } from '@/lib/audit'
import { logDataAccess, logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id, docId } = await params
  if (!isValidUUID(id) || !isValidUUID(docId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const versionParam = req.nextUrl.searchParams.get('version')
  const versionNo = versionParam ? parseInt(versionParam, 10) : null

  const { rows } = await pool.query(
    `SELECT dv.storage_path, dv.file_name, dv.mime_type, dv.version_no
     FROM document_versions dv
     JOIN candidate_documents cd ON cd.id = dv.document_id
     WHERE cd.id = $1 AND cd.resume_id = $2 AND cd.tenant_id = $3
       ${versionNo ? 'AND dv.version_no = $4' : ''}
     ORDER BY dv.version_no DESC
     LIMIT 1`,
    versionNo
      ? [docId, id, ctx.tenantId, versionNo]
      : [docId, id, ctx.tenantId]
  )

  const row = rows[0] as { storage_path: string; file_name: string; mime_type: string | null; version_no: number } | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let buf: Buffer
  try {
    buf = await readStoredFile(row.storage_path)
  } catch {
    return NextResponse.json({ error: 'File missing' }, { status: 404 })
  }

  const ext = path.extname(row.storage_path).toLowerCase()
  const mime = row.mime_type ?? mimeForExt(ext)
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const disposition = inline ? 'inline' : `attachment; filename="${row.file_name}"`

  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: inline ? 'candidate.document.view' : 'candidate.document.download',
      resourceType: 'candidate_document',
      resourceId: docId,
      details: { candidate_id: id, version_no: row.version_no },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logDataAccess({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      userRole: ctx.tenantRole,
      accessType: inline ? 'candidate_document_view' : 'candidate_document_download',
      resourceType: 'candidate_document',
      resourceId: docId,
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: inline ? 'candidate.document.view' : 'candidate.document.download',
      resourceType: 'candidate_document',
      resourceId: docId,
      tenantId: ctx.tenantId,
      details: { candidate_id: id, version_no: row.version_no },
    }),
  ])

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
