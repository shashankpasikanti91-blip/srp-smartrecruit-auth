import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { computeRecruiterKpi, computeTenantFunnel } from '@/lib/kpiEngine'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'reports.read')
  if (ctx instanceof NextResponse) return ctx

  const type = req.nextUrl.searchParams.get('type') ?? 'kpi'
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)

  if (type === 'kpi') {
    const kpi = await computeRecruiterKpi({ tenantId: ctx.tenantId, userId: ctx.userId, days })
    const lines = [
      'Metric,Value',
      `Candidates Added,${kpi.candidates_added}`,
      `AI Screened,${kpi.candidates_screened}`,
      `Submissions,${kpi.submissions}`,
      `Interviews Scheduled,${kpi.interviews_scheduled}`,
      `Interviews Completed,${kpi.interviews_completed}`,
      `Comms Sent,${kpi.comms_sent}`,
      `Follow-ups Pending,${kpi.follow_ups_pending}`,
      `Follow-ups Overdue,${kpi.follow_ups_overdue}`,
      `Active Offers,${kpi.offers_active}`,
    ]
    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kpi-report-${days}d.csv"`,
      },
    })
  }

  if (type === 'funnel' && (ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin')) {
    const data = await computeTenantFunnel(ctx.tenantId, days)
    const lines = ['Stage,Count']
    for (const [k, v] of Object.entries(data.funnel)) lines.push(`${k},${v}`)
    lines.push('')
    lines.push('Submission Stage,Count')
    for (const [k, v] of Object.entries(data.submission_stages)) lines.push(`${k},${v}`)
    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="funnel-report-${days}d.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid report type or forbidden' }, { status: 400 })
}
