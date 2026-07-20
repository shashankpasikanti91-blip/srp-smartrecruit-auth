import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { computeTenantFunnel } from '@/lib/kpiEngine'

/** GET /api/analytics/tenant — tenant funnel (admin/owner only). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'analytics.tenant')
  if (ctx instanceof NextResponse) return ctx

  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Tenant analytics requires admin or owner role' }, { status: 403 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)
  const data = await computeTenantFunnel(ctx.tenantId, days)
  return NextResponse.json(data)
}
