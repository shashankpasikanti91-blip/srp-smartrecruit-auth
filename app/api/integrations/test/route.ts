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
      await pool.query(
        `UPDATE integrations SET config = COALESCE(config, '{}'::jsonb) || $3::jsonb, updated_at = NOW()
         WHERE tenant_id = $1 AND slug = 'telegram'`,
        [ctx.tenantId, ctx.userId, JSON.stringify({ connection_status: 'connected', last_tested_at: new Date().toISOString() })]
      ).catch(() => {})
      return NextResponse.json({
        ok: true,
        status: 'connected',
        bot: data.result?.username,
        latency_ms: Date.now() - started,
      })
    }

    if (body.type === 'connector' || body.type === 'whatsapp') {
      const slug = body.connector_id || (body.type === 'whatsapp' ? 'whatsapp' : null)
      if (!slug) {
        return NextResponse.json({ error: 'connector_id required' }, { status: 422 })
      }
      const { rows } = await pool.query(
        `SELECT id, config, status FROM integrations WHERE tenant_id=$1 AND slug=$2`,
        [ctx.tenantId, slug]
      )
      if (!rows[0]) {
        return NextResponse.json({ ok: false, status: 'not_configured', latency_ms: Date.now() - started })
      }
      const cfg = (rows[0].config ?? {}) as Record<string, string>

      if (slug === 'whatsapp' || slug === 'whatsapp_twilio_legacy') {
        let ok = false
        let detail: string | undefined
        if (cfg.access_token && cfg.phone_number_id) {
          const version = (cfg.api_version || 'v19.0').replace(/^\/*/, '')
          const res = await fetch(
            `https://graph.facebook.com/${version}/${cfg.phone_number_id}`,
            { headers: { Authorization: `Bearer ${cfg.access_token}` } }
          )
          ok = res.ok
          if (!ok) detail = `Meta Graph ${res.status}`
        } else if (cfg.account_sid && cfg.auth_token) {
          const creds = Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString('base64')
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}.json`,
            { headers: { Authorization: `Basic ${creds}` } }
          )
          ok = res.ok
          if (!ok) detail = `Twilio ${res.status}`
        } else {
          return NextResponse.json({
            ok: false,
            status: 'configuration_required',
            error: 'Meta access_token + phone_number_id required (or Twilio legacy fields)',
            latency_ms: Date.now() - started,
          })
        }
        const connection_status = ok ? 'connected' : 'connection_failed'
        await pool.query(
          `UPDATE integrations
           SET status = CASE WHEN $3 THEN 'active' ELSE status END,
               config = COALESCE(config, '{}'::jsonb) || $4::jsonb,
               updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [
            rows[0].id,
            ctx.tenantId,
            ok,
            JSON.stringify({ connection_status, last_tested_at: new Date().toISOString() }),
          ]
        ).catch(() => {})
        await logAudit({
          userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
          action: ok ? 'provider_test_ok' : 'provider_test_failed',
          resourceType: 'integration', resourceId: String(rows[0].id),
          details: { slug, connection_status }, module: 'integrations',
          result: ok ? 'success' : 'failure',
        })
        return NextResponse.json({
          ok,
          status: connection_status,
          error: detail,
          latency_ms: Date.now() - started,
        })
      }

      if (slug === 'telegram') {
        const token = cfg.bot_token
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
        await pool.query(
          `UPDATE integrations SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
           WHERE tenant_id = $1 AND slug = 'telegram'`,
          [ctx.tenantId, JSON.stringify({ connection_status: 'connected', last_tested_at: new Date().toISOString() })]
        ).catch(() => {})
        return NextResponse.json({
          ok: true,
          status: 'connected',
          bot: data.result?.username,
          latency_ms: Date.now() - started,
        })
      }

      // Email connectors: SMTP / Outlook SMTP / SendGrid / Mailgun
      if (['smtp', 'outlook', 'sendgrid', 'mailgun'].includes(slug)) {
        let ok = false
        let detail: string | undefined
        try {
          if (slug === 'sendgrid') {
            if (!cfg.api_key) {
              return NextResponse.json({
                ok: false, status: 'configuration_required',
                error: 'SendGrid api_key required', latency_ms: Date.now() - started,
              })
            }
            const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
              headers: { Authorization: `Bearer ${cfg.api_key}` },
            })
            ok = res.ok
            if (!ok) detail = `SendGrid ${res.status}`
          } else if (slug === 'mailgun') {
            if (!cfg.api_key || !cfg.domain) {
              return NextResponse.json({
                ok: false, status: 'configuration_required',
                error: 'Mailgun api_key + domain required', latency_ms: Date.now() - started,
              })
            }
            const res = await fetch(`https://api.mailgun.net/v3/${cfg.domain}`, {
              headers: {
                Authorization: `Basic ${Buffer.from(`api:${cfg.api_key}`).toString('base64')}`,
              },
            })
            ok = res.ok
            if (!ok) detail = `Mailgun ${res.status}`
          } else {
            // smtp / outlook — nodemailer.verify()
            if (!cfg.host || !cfg.username || !cfg.password) {
              return NextResponse.json({
                ok: false, status: 'configuration_required',
                error: 'SMTP host, username, and password (app password) required',
                latency_ms: Date.now() - started,
              })
            }
            const nodemailer = await import('nodemailer')
            const port = parseInt(cfg.port ?? '587', 10)
            const transport = nodemailer.default.createTransport({
              host: cfg.host,
              port,
              secure: port === 465,
              auth: { user: cfg.username, pass: cfg.password },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 12_000,
            })
            await transport.verify()
            ok = true
          }
        } catch (e) {
          ok = false
          detail = e instanceof Error ? e.message.slice(0, 200) : 'verify failed'
        }

        const connection_status = ok ? 'connected' : 'connection_failed'
        await pool.query(
          `UPDATE integrations
           SET status = CASE WHEN $3 THEN 'active' ELSE status END,
               config = COALESCE(config, '{}'::jsonb) || $4::jsonb,
               updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [
            rows[0].id,
            ctx.tenantId,
            ok,
            JSON.stringify({ connection_status, last_tested_at: new Date().toISOString() }),
          ]
        ).catch(() => {})
        await logAudit({
          userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
          action: ok ? 'provider_test_ok' : 'provider_test_failed',
          resourceType: 'integration', resourceId: String(rows[0].id),
          details: { slug, connection_status }, module: 'integrations',
          result: ok ? 'success' : 'failure',
        })
        return NextResponse.json({
          ok,
          status: connection_status,
          error: detail,
          latency_ms: Date.now() - started,
        })
      }

      return NextResponse.json({
        ok: false,
        status: 'not_supported',
        error: `No automated test for connector ${slug}`,
        latency_ms: Date.now() - started,
      }, { status: 422 })
    }

    if (body.type === 'hub_status') {
      const [email, calendar] = await Promise.all([
        getEmailConnections(ctx.tenantId, ctx.userId),
        getCalendarConnections(ctx.tenantId, ctx.userId),
      ])
      const { rows: integ } = await pool.query(
        `SELECT slug, status, config->>'connection_status' AS connection_status,
                config->>'last_tested_at' AS last_tested_at
         FROM integrations WHERE tenant_id = $1`,
        [ctx.tenantId]
      )
      return NextResponse.json({
        email,
        calendar,
        integrations: integ,
        note: 'Connected only after successful Test. One Azure/Google app registration serves the platform; each recruiter Connects their own mailbox/calendar.',
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
