import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { isValidUUID } from '@/lib/validate'
import {
  DEFAULT_OWNERSHIP_DAYS,
  ensureOwnership,
  getActiveOwnership,
  getOwnershipHistory,
  isOwnershipEntityType,
  isOwnershipExpired,
  transferOwnership,
} from '@/lib/ownership'

/** GET /api/ownership?entityType=&entityId= */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const entityType = req.nextUrl.searchParams.get('entityType') ?? ''
  const entityId = req.nextUrl.searchParams.get('entityId') ?? ''

  if (!isOwnershipEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }

  const [record, history] = await Promise.all([
    getActiveOwnership(ctx.tenantId, entityType, entityId),
    getOwnershipHistory(ctx.tenantId, entityType, entityId),
  ])

  return NextResponse.json({
    ownership: record
      ? { ...record, expired: isOwnershipExpired(record), default_days: DEFAULT_OWNERSHIP_DAYS }
      : null,
    history,
  })
}

/** POST /api/ownership — assign / transfer / extend / archive */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    entityType?: string
    entityId?: string
    toUserId?: string
    action?: 'assign' | 'transfer' | 'extend' | 'archive'
    reason?: string
    approvedBy?: string
    extendDays?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const entityType = body.entityType ?? ''
  const entityId = body.entityId ?? ''
  const action = body.action ?? 'transfer'

  if (!isOwnershipEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }

  const canManage =
    ctx.tenantRole === 'owner' ||
    ctx.tenantRole === 'admin' ||
    ctx.permissions.users.manage

  if ((action === 'transfer' || action === 'archive') && !canManage) {
    return NextResponse.json(
      { error: 'Only owner/admin can transfer or archive ownership' },
      { status: 403 },
    )
  }

  if (action === 'assign') {
    const toUserId = body.toUserId ?? ctx.userId
    if (!isValidUUID(toUserId)) {
      return NextResponse.json({ error: 'Invalid toUserId' }, { status: 400 })
    }
    const record = await ensureOwnership({
      tenantId: ctx.tenantId,
      entityType,
      entityId,
      ownerUserId: toUserId,
      actorUserId: ctx.userId,
      days: body.extendDays ?? DEFAULT_OWNERSHIP_DAYS,
    })
    return NextResponse.json({ ok: true, ownership: record })
  }

  const toUserId = body.toUserId ?? ctx.userId
  if (action !== 'archive' && !isValidUUID(toUserId)) {
    return NextResponse.json({ error: 'Invalid toUserId' }, { status: 400 })
  }

  const result = await transferOwnership({
    tenantId: ctx.tenantId,
    entityType,
    entityId,
    toUserId,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    reason: body.reason,
    approvedBy: body.approvedBy,
    extendDays: body.extendDays,
    action,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    ownership: result.record
      ? { ...result.record, expired: isOwnershipExpired(result.record) }
      : null,
  })
}
