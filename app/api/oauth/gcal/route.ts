/**
 * app/api/oauth/gcal/route.ts
 * Initiates Google Calendar OAuth flow.
 * GET /api/oauth/gcal
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }             from '@/lib/tenant'
import { googleCalendarAuthUrl }     from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const origin      = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  const redirectUri = `${origin}/api/oauth/gcal/callback`
  const url         = googleCalendarAuthUrl(ctx.userId, ctx.tenantId, redirectUri)

  return NextResponse.redirect(url)
}
