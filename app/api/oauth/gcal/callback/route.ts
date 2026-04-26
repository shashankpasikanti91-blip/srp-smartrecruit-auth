/**
 * app/api/oauth/gcal/callback/route.ts
 * Google Calendar OAuth callback — exchanges code and saves connection.
 */
import { NextRequest, NextResponse }                          from 'next/server'
import { exchangeGoogleCalToken, saveCalendarConnection }     from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = process.env.NEXTAUTH_URL ?? url.origin

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&cal_error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&cal_error=missing_params`)
  }

  let stateData: { userId: string; tenantId: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'))
  } catch {
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&cal_error=invalid_state`)
  }

  try {
    const redirectUri = `${origin}/api/oauth/gcal/callback`
    const tokens = await exchangeGoogleCalToken(code, redirectUri)
    await saveCalendarConnection(
      stateData.tenantId,
      stateData.userId,
      'google',
      tokens.access_token,
      tokens.refresh_token,
      tokens.email,
      tokens.name
    )
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&cal_connected=google`)
  } catch (err) {
    console.error('[oauth/gcal/callback]', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(`${origin}/dashboard?tab=settings&cal_error=${encodeURIComponent(msg)}`)
  }
}
