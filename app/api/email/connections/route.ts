/**
 * app/api/email/connections/route.ts
 * Lists / disconnects a user's email OAuth connections.
 *
 * GET    /api/email/connections
 * DELETE /api/email/connections?provider=gmail|outlook
 */
import { NextRequest, NextResponse }      from 'next/server'
import { requireTenant }                  from '@/lib/tenant'
import { getEmailConnections, disconnectEmailProvider } from '@/lib/email-oauth'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const connections = await getEmailConnections(ctx.tenantId, ctx.userId)
  return NextResponse.json({ connections })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const provider = new URL(req.url).searchParams.get('provider')
  if (!provider || !['gmail', 'outlook'].includes(provider)) {
    return NextResponse.json({ error: '`provider` must be gmail or outlook' }, { status: 422 })
  }

  await disconnectEmailProvider(ctx.tenantId, ctx.userId, provider)
  return NextResponse.json({ ok: true, provider })
}
