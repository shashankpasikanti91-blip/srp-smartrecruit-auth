/**
 * GET    /api/security/sessions — list my sessions
 * POST   /api/security/sessions — { action: 'terminate'|'terminate_others', session_id? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { listUserSessions, terminateSession, terminateOtherSessions } from '@/lib/sessions'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const currentToken = req.cookies.get('srp_session_token')?.value ?? null
  const sessions = await listUserSessions(ctx.userId)
  return NextResponse.json({
    sessions: sessions.map(s => ({
      ...s,
      is_current: Boolean(currentToken && s.session_token === currentToken),
    })),
    current_token: currentToken ? currentToken.slice(0, 8) + '…' : null,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: { action?: string; session_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const currentToken = req.cookies.get('srp_session_token')?.value ?? null

  if (body.action === 'terminate') {
    if (!body.session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 422 })
    }
    const ok = await terminateSession({ userId: ctx.userId, sessionId: body.session_id })
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      tenantId: ctx.tenantId,
      action: 'session_terminate',
      resourceType: 'user_session',
      resourceId: body.session_id,
      module: 'security',
      result: ok ? 'success' : 'failure',
    })
    return NextResponse.json({ ok })
  }

  if (body.action === 'terminate_others') {
    const n = await terminateOtherSessions({
      userId: ctx.userId,
      keepToken: currentToken,
    })
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      tenantId: ctx.tenantId,
      action: 'session_terminate_others',
      resourceType: 'user_session',
      details: { count: n },
      module: 'security',
    })
    return NextResponse.json({ ok: true, terminated: n })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 422 })
}
