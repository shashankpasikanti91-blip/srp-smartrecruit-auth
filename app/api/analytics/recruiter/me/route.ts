import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { computeRecruiterKpi } from '@/lib/kpiEngine'

/** GET /api/analytics/recruiter/me — personal KPI strip (all recruiters). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'analytics.self')
  if (ctx instanceof NextResponse) return ctx

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const kpi = await computeRecruiterKpi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      days,
    })
    return NextResponse.json({ kpi, user_id: ctx.userId })
  } catch (e) {
    console.error('[analytics recruiter/me]', e)
    return NextResponse.json({
      kpi: {
        period_days: days,
        candidates_added: 0,
        candidates_screened: 0,
        submissions: 0,
        interviews_scheduled: 0,
        interviews_completed: 0,
        comms_sent: 0,
        follow_ups_pending: 0,
        follow_ups_overdue: 0,
        offers_active: 0,
        submission_conversion_rate: 0,
        interview_conversion_rate: 0,
        pipeline_by_stage: {},
      },
      user_id: ctx.userId,
    })
  }
}
