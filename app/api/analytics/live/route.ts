import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, canAccessRecruitersModule } from '@/lib/tenant'
import { computeLiveOpsStrip } from '@/lib/kpiEngine'

/**
 * GET /api/analytics/live?days=30&scope=auto
 * Lightweight ops strip for Dashboard live poll (Phase D).
 * scope=auto → tenant rollup for manager/head/admin; self for recruiters.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const days = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const scopeParam = req.nextUrl.searchParams.get('scope') ?? 'auto'

  const canTeam =
    canAccessRecruitersModule(ctx.tenantRole, ctx.permissions) ||
    ctx.tenantRole === 'owner' ||
    ctx.tenantRole === 'admin'

  let scope: 'self' | 'tenant' = 'self'
  if (scopeParam === 'tenant' && canTeam) scope = 'tenant'
  else if (scopeParam === 'self') scope = 'self'
  else if (scopeParam === 'auto' && canTeam) scope = 'tenant'

  try {
    const strip = await computeLiveOpsStrip({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      scope,
      days,
    })
    return NextResponse.json({
      ok: true,
      strip,
      live: true,
      poll_hint_sec: 45,
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[analytics/live]', e)
    return NextResponse.json({ error: 'Live analytics unavailable' }, { status: 500 })
  }
}
