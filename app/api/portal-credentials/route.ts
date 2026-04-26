/**
 * app/api/portal-credentials/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD for portal integration credentials per tenant.
 *
 * GET    /api/portal-credentials         — list configured portals (masked keys)
 * POST   /api/portal-credentials         — save/update credentials for a portal
 * DELETE /api/portal-credentials?portal= — remove credentials for a portal
 * POST   /api/portal-credentials/test    — test connection for a portal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }             from '@/lib/tenant'
import { pool }                      from '@/lib/db'
import { savePortalCreds, testPortalConnection } from '@/lib/portals'

// ── GET — list configured portals ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'integrations.view')
  if (ctx instanceof NextResponse) return ctx

  const { rows } = await pool.query(
    `SELECT portal, username, is_active, created_at, updated_at,
            CASE WHEN api_key IS NOT NULL THEN TRUE ELSE FALSE END AS has_api_key,
            CASE WHEN api_secret IS NOT NULL THEN TRUE ELSE FALSE END AS has_api_secret,
            extra_config
     FROM portal_credentials
     WHERE tenant_id = $1
     ORDER BY portal ASC`,
    [ctx.tenantId]
  )

  return NextResponse.json({ portals: rows })
}

// ── POST — save/update credentials ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Allow test action via URL path
  const url = new URL(req.url)
  if (url.pathname.endsWith('/test')) {
    return handleTest(req)
  }

  const ctx = await requireTenant(req, 'integrations.manage')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    portal:       string
    api_key?:     string
    api_secret?:  string
    username?:    string
    password?:    string
    base_url?:    string
    extra_config?: Record<string, string>
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const SUPPORTED = ['naukri', 'monster', 'shine', 'linkedin', 'indeed']
  if (!body.portal || !SUPPORTED.includes(body.portal)) {
    return NextResponse.json({ error: `Invalid portal. Supported: ${SUPPORTED.join(', ')}` }, { status: 422 })
  }

  if (!body.api_key && !body.username) {
    return NextResponse.json({ error: 'Provide at least api_key or username' }, { status: 422 })
  }

  await savePortalCreds(ctx.tenantId, body.portal, {
    api_key:      body.api_key,
    api_secret:   body.api_secret,
    username:     body.username,
    password:     body.password,
    base_url:     body.base_url,
    extra_config: body.extra_config,
  })

  return NextResponse.json({ ok: true, portal: body.portal })
}

// ── DELETE — remove credentials ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const ctx = await requireTenant(req, 'integrations.manage')
  if (ctx instanceof NextResponse) return ctx

  const portal = new URL(req.url).searchParams.get('portal')
  if (!portal) return NextResponse.json({ error: '`portal` query param required' }, { status: 422 })

  await pool.query(
    `UPDATE portal_credentials SET is_active = FALSE, updated_at = NOW()
     WHERE tenant_id = $1 AND portal = $2`,
    [ctx.tenantId, portal]
  )

  return NextResponse.json({ ok: true, portal })
}

// ── Test connection handler ────────────────────────────────────────────────────

async function handleTest(req: NextRequest) {
  const ctx = await requireTenant(req, 'integrations.view')
  if (ctx instanceof NextResponse) return ctx

  let body: { portal: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await testPortalConnection(ctx.tenantId, body.portal)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
