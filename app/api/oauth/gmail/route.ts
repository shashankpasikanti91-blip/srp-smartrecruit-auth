/**
 * app/api/oauth/gmail/route.ts
 * Initiates Gmail OAuth flow — redirects user to Google's consent screen.
 * GET /api/oauth/gmail
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }             from '@/lib/tenant'
import { gmailAuthUrl }              from '@/lib/email-oauth'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const origin      = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  const redirectUri = `${origin}/api/oauth/gmail/callback`
  const url         = gmailAuthUrl(ctx.userId, ctx.tenantId, redirectUri)

  return NextResponse.redirect(url)
}
