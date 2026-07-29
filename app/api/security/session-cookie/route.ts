/**
 * Sync JWT sessionToken → HttpOnly cookie for session tracking / terminate.
 * POST /api/security/session-cookie
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = (session.user as Record<string, unknown>).sessionToken as string | null | undefined
  const res = NextResponse.json({ ok: true, has_token: Boolean(token) })
  if (token) {
    res.cookies.set('srp_session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('srp_session_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
