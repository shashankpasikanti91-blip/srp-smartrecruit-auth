import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import {
  findDuplicateCandidates,
  hashResumeContent,
  normalizeEmail,
} from '@/lib/duplicateCheck'

/**
 * POST /api/candidates/check-duplicate
 * Preflight check before creating a candidate — tenant-scoped only.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    email?: string
    phone?: string
    passport?: string
    linkedin?: string
    resume_text?: string
    exclude_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = normalizeEmail(body.email)
  const phone = body.phone ?? ''
  const passport = body.passport ?? ''
  const linkedin = body.linkedin ?? ''
  const resumeHash = hashResumeContent(body.resume_text)

  if (!email && !phone && !passport && !linkedin && !resumeHash) {
    return NextResponse.json({ duplicates: [], is_duplicate: false })
  }

  const duplicates = await findDuplicateCandidates({
    tenantId: ctx.tenantId,
    email,
    phone,
    passport,
    linkedin,
    resumeHash: resumeHash || null,
    excludeId: body.exclude_id ?? null,
  })

  return NextResponse.json({
    is_duplicate: duplicates.length > 0,
    duplicates,
  })
}
