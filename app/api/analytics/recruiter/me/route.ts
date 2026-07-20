import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { computeRecruiterKpi } from '@/lib/kpiEngine'

/** GET /api/analytics/recruiter/me — personal KPI strip (all recruiters). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'analytics.self')
  if (ctx instanceof NextResponse) return ctx

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const kpi = await computeRecruiterKpi({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    days,
  })

  return NextResponse.json({ kpi, user_id: ctx.userId })
}
