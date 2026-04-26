/**
 * app/api/oauth/outlookcal/route.ts + callback/route.ts
 * Outlook Calendar OAuth flow.
 */
import { NextRequest, NextResponse }                             from 'next/server'
import { requireTenant }                                         from '@/lib/tenant'
import { outlookCalendarAuthUrl }                                from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const origin      = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  const redirectUri = `${origin}/api/oauth/outlookcal/callback`
  const url         = outlookCalendarAuthUrl(ctx.userId, ctx.tenantId, redirectUri)

  return NextResponse.redirect(url)
}
