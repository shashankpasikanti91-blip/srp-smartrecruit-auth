/**
 * app/api/oauth/outlook/route.ts
 * Initiates Outlook (Microsoft 365) OAuth flow.
 * GET /api/oauth/outlook
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }             from '@/lib/tenant'
import { outlookAuthUrl }            from '@/lib/email-oauth'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const origin      = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  const redirectUri = `${origin}/api/oauth/outlook/callback`
  const url         = outlookAuthUrl(ctx.userId, ctx.tenantId, redirectUri)

  return NextResponse.redirect(url)
}
