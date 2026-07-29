/**
 * GET/PATCH /api/security/policy — tenant password / MFA policy
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'
import { getTenantSecuritySettings, upsertTenantSecuritySettings } from '@/lib/passwordPolicy'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  const settings = await getTenantSecuritySettings(ctx.tenantId)
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const settings = await upsertTenantSecuritySettings(
    ctx.tenantId,
    body as Parameters<typeof upsertTenantSecuritySettings>[1]
  )
  await logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
    action: 'security_policy_updated', resourceType: 'tenant_security_settings',
    details: body, module: 'security',
  })
  return NextResponse.json({ settings })
}
