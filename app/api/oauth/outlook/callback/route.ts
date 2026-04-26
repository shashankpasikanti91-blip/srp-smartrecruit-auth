/**
 * app/api/oauth/outlook/callback/route.ts
 * Handles Microsoft OAuth callback — exchanges code for tokens and saves connection.
 * GET /api/oauth/outlook/callback?code=...&state=...
 */
import { NextRequest, NextResponse } from 'next/server'
import { exchangeOutlookCode, saveEmailConnection } from '@/lib/email-oauth'

export async function GET(req: NextRequest) {
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = process.env.NEXTAUTH_URL ?? url.origin

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&email_error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&email_error=missing_params`)
  }

  let stateData: { userId: string; tenantId: string; provider: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'))
  } catch {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&email_error=invalid_state`)
  }

  try {
    const redirectUri = `${origin}/api/oauth/outlook/callback`
    const tokens = await exchangeOutlookCode(code, redirectUri)

    await saveEmailConnection(
      stateData.tenantId,
      stateData.userId,
      'outlook',
      tokens.access_token,
      tokens.refresh_token,
      tokens.email,
      tokens.name
    )

    return NextResponse.redirect(`${origin}/dashboard?tab=settings&email_connected=outlook`)
  } catch (err) {
    console.error('[oauth/outlook/callback]', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&email_error=${encodeURIComponent(msg)}`)
  }
}
