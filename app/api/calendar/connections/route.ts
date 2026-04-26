/**
 * app/api/calendar/connections/route.ts
 * List / disconnect calendar connections for the current user.
 *
 * GET    /api/calendar/connections
 * DELETE /api/calendar/connections?provider=google|outlook
 */
import { NextRequest, NextResponse }                       from 'next/server'
import { requireTenant }                                   from '@/lib/tenant'
import { getCalendarConnections, disconnectCalendar }      from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const connections = await getCalendarConnections(ctx.tenantId, ctx.userId)
  return NextResponse.json({ connections })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const provider = new URL(req.url).searchParams.get('provider')
  if (!provider || !['google', 'outlook'].includes(provider)) {
    return NextResponse.json({ error: '`provider` must be google or outlook' }, { status: 422 })
  }

  await disconnectCalendar(ctx.tenantId, ctx.userId, provider)
  return NextResponse.json({ ok: true, provider })
}
