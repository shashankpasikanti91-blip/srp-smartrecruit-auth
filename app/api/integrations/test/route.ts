/**
 * POST /api/integrations/test — Test Connection for OAuth email/calendar/telegram
 * Body: { type: 'email'|'calendar'|'telegram'|'connector', provider?: string, connector_id?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { getEmailConnections } from '@/lib/email-oauth'
import { getCalendarConnections } from '@/lib/calendar'

async function markEmailReconnect(tenantId: string, userId: string, provider: string) {
  await pool.query(
    `UPDATE email_connections SET is_active = FALSE, updated_at = NOW()
     WHERE tenant_id = $1 AND user_id = $2 AND provider = $3`,
    [tenantId, userId, provider]
  ).catch(() => {})
}

async function markCalendarReconnect(tenantId: string, userId: string, provider: string) {
  await pool.query(
    `UPDATE calendar_connections SET is_active = FALSE, updated_at = NOW()
     WHERE tenant_id = $1 AND user_id = $2 AND provider = $3`,
    [tenantId, userId, provider]
  ).catch(() => {})
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: { type?: string; provider?: string; connector_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const started = Date.now()

  try {
    if (body.type === 'email') {
      const provider = body.provider as 'gmail' | 'outlook'
      if (!provider || !['gmail', 'outlook'].includes(provider)) {
        return NextResponse.json({ error: 'provider must be gmail or outlook' }, { status: 422 })
      }
      const { rows } = await pool.query(
        `SELECT access_token_enc, refresh_token_enc, email_address, is_active
         FROM email_connections WHERE tenant_id=$1 AND user_id=$2 AND provider=$3`,
        [ctx.tenantId, ctx.userId, provider]
      )
      if (!rows[0]) {
        return NextResponse.json({ ok: false, status: 'not_connected', latency_ms: Date.now() - started })
      }
      // Light probe: refresh path via send readiness — call provider userinfo/me
      const { testEmailConnection } = await import('@/lib/email-oauth')
      const result = await testEmailConnection(ctx.tenantId, ctx.userId, provider)
      if (!result.ok) {
        await markEmailReconnect(ctx.tenantId, ctx.userId, provider)
        await logAudit({
          userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
          action: 'oauth_test_failed', resourceType: 'email_connection',
          details: { provider, error: result.error }, module: 'integrations', result: 'failure',
        })
        return NextResponse.json({
          ok: false,
          status: 'reconnect_required',
          error: result.error,
          latency_ms: Date.now() - started,
        })
      }
      await logAudit({
        userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
        action: 'oauth_test_ok', resourceType: 'email_connection',
        details: { provider, email: result.email, scopes_ok: true }, module: 'integrations',
      })
      return NextResponse.json({
        ok: true,
        status: 'connected',
        email: result.email,
        latency_ms: Date.now() - started,
      })
    }

    if (body.type === 'calendar') {
      const provider = body.provider as 'google' | 'outlook'
      if (!provider || !['google', 'outlook'].includes(provider)) {
        return NextResponse.json({ error: 'provider must be google or outlook' }, { status: 422 })
      }
      const { testCalendarConnection } = await import('@/lib/calendar')
      const result = await testCalendarConnection(ctx.tenantId, ctx.userId, provider)
      if (!result.ok) {
        await markCalendarReconnect(ctx.tenantId, ctx.userId, provider)
        await logAudit({
          userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
          action: 'oauth_test_failed', resourceType: 'calendar_connection',
          details: { provider, error: result.error }, module: 'integrations', result: 'failure',
        })
        return NextResponse.json({
          ok: false,
          status: 'reconnect_required',
          error: result.error,
          latency_ms: Date.now() - started,
        })
      }
      await logAudit({
        userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
        action: 'oauth_test_ok', resourceType: 'calendar_connection',
        details: { provider }, module: 'integrations',
      })
      return NextResponse.json({
        ok: true,
        status: 'connected',
        email: result.email,
        latency_ms: Date.now() - started,
      })
    }

    if (body.type === 'telegram') {
      const { rows } = await pool.query(
        `SELECT config FROM integrations WHERE tenant_id=$1 AND slug='telegram' AND status='active'`,
        [ctx.tenantId]
      )
      const token = (rows[0]?.config as { bot_token?: string } | null)?.bot_token
      if (!token) {
        return NextResponse.json({ ok: false, status: 'not_configured', latency_ms: Date.now() - started })
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const data = await res.json() as { ok?: boolean; result?: { username?: string }; description?: string }
      if (!data.ok) {
        return NextResponse.json({
          ok: false,
          status: 'failed',
          error: data.description ?? 'Telegram getMe failed',
          latency_ms: Date.now() - started,
        })
      }
      return NextResponse.json({
        ok: true,
        status: 'connected',
        bot: data.result?.username,
        latency_ms: Date.now() - started,
      })
    }

    if (body.type === 'hub_status') {
      const [email, calendar] = await Promise.all([
        getEmailConnections(ctx.tenantId, ctx.userId),
        getCalendarConnections(ctx.tenantId, ctx.userId),
      ])
      return NextResponse.json({
        email,
        calendar,
        note: 'One Azure/Google app registration serves the platform; each recruiter Connects their own mailbox/calendar.',
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 422 })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      status: 'error',
      error: err instanceof Error ? err.message : 'Test failed',
      latency_ms: Date.now() - started,
    }, { status: 500 })
  }
}
