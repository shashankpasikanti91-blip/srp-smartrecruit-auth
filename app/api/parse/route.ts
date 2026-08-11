import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { extractResumeFields } from '@/lib/resumeExtract'
import { extractTextFromUpload } from '@/lib/extractFileText'
import { notifyError } from '@/lib/notifications'

export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ ok: true, max_mb: 15, types: ['.pdf', '.docx', '.doc', '.txt'] })
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireTenant(req)
    if (ctx instanceof NextResponse) return ctx

    const allowed =
      checkPermission(ctx.permissions, 'candidates.create') ||
      checkPermission(ctx.permissions, 'jobs.create') ||
      checkPermission(ctx.permissions, 'jd_intel.use') ||
      checkPermission(ctx.permissions, 'ai_screen.use')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden: you lack permission to upload files in this workspace' },
        { status: 403 },
      )
    }

    let file: File | null = null
    try {
      const form = await req.formData()
      file = form.get('file') as File | null
    } catch {
      return NextResponse.json(
        { error: 'Could not read the upload. File may be too large (max 15 MB) — try TXT or paste the text.' },
        { status: 400 },
      )
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    try {
      const { text, filename, size } = await extractTextFromUpload(file)
      const extracted = extractResumeFields(text, filename)
      return NextResponse.json({
        text,
        filename,
        size,
        name: extracted.name,
        email: extracted.email,
        phone: extracted.phone,
      })
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number }
      const status = typeof err.status === 'number' ? err.status : 500
      console.error('[api/parse]', err.message)
      if (status >= 500) {
        void notifyError({
          message: `File parse failed: ${err.message || 'unknown'} (${file.name})`,
          severity: 'critical',
        }).catch(() => null)
      }
      return NextResponse.json(
        { error: err.message || 'Failed to parse file. Paste the text instead.' },
        { status: status >= 400 && status < 600 ? status : 500 },
      )
    }
  } catch (fatal) {
    console.error('[api/parse] fatal', fatal)
    void notifyError({
      message: `File parse fatal: ${fatal instanceof Error ? fatal.message : String(fatal)}`,
      severity: 'critical',
    }).catch(() => null)
    return NextResponse.json(
      { error: 'Parser hit an unexpected error. Paste the text or retry in a few seconds.' },
      { status: 500 },
    )
  }
}
