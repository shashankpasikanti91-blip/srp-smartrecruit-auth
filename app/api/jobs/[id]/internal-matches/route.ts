import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { isValidUUID } from '@/lib/validate'
import { computeInternalMatches } from '@/lib/internalMatch'

/** GET /api/jobs/[id]/internal-matches — tenant-scoped talent pool ranking */
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

  const limit = Math.min(
    50,
    Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10) || 25),
  )

  const result = await computeInternalMatches(ctx.tenantId, id, limit)

  // Optional filters (client-side friendly — also applied server-side)
  const location = (req.nextUrl.searchParams.get('location') ?? '').toLowerCase()
  const nationality = (req.nextUrl.searchParams.get('nationality') ?? '').toLowerCase()
  const notice = (req.nextUrl.searchParams.get('notice') ?? '').toLowerCase()
  const visa = (req.nextUrl.searchParams.get('visa') ?? '').toLowerCase()
  const minScore = parseInt(req.nextUrl.searchParams.get('min_score') ?? '0', 10) || 0
  const skill = (req.nextUrl.searchParams.get('skill') ?? '').toLowerCase()

  let matches = result.matches
  if (location) {
    matches = matches.filter(m => (m.location ?? '').toLowerCase().includes(location))
  }
  if (nationality) {
    matches = matches.filter(m => (m.nationality ?? '').toLowerCase().includes(nationality))
  }
  if (notice) {
    matches = matches.filter(m => (m.notice_period ?? '').toLowerCase().includes(notice))
  }
  if (visa) {
    matches = matches.filter(m => (m.visa ?? '').toLowerCase().includes(visa))
  }
  if (minScore > 0) {
    matches = matches.filter(m => m.match_percent >= minScore || (m.ai_score ?? 0) >= minScore)
  }
  if (skill) {
    matches = matches.filter(m => m.skills.some(s => s.toLowerCase().includes(skill)))
  }

  return NextResponse.json({
    job_title: result.job_title,
    matches,
    total: matches.length,
  })
}
