import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import {
  listNotifications,
  unreadCount,
  markNotificationsRead,
  createNotification,
  archiveNotifications,
  deleteNotifications,
} from '@/lib/notificationCenter'
import { sanitizeText } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const type = req.nextUrl.searchParams.get('type') ?? 'list'

  if (type === 'unread_count') {
    const unread = await unreadCount(ctx.userId, ctx.tenantId)
    return NextResponse.json({ unread })
  }

  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1'
  const archived = req.nextUrl.searchParams.get('archived') === '1'
  const notifications = await listNotifications({
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    unreadOnly,
    archived,
    limit: 50,
  })
  const unread = await unreadCount(ctx.userId, ctx.tenantId)
  return NextResponse.json({ notifications, unread })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'mark_read') {
    await markNotificationsRead({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      ids: Array.isArray(body.ids) ? body.ids : undefined,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'archive') {
    const ids = Array.isArray(body.ids) ? body.ids : []
    await archiveNotifications({ userId: ctx.userId, tenantId: ctx.tenantId, ids })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const ids = Array.isArray(body.ids) ? body.ids : []
    await deleteNotifications({ userId: ctx.userId, tenantId: ctx.tenantId, ids })
    return NextResponse.json({ ok: true })
  }

  if (action === 'create') {
    // Only self — prevents cross-user notification spam
    const title = sanitizeText(body.title, 300)
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: sanitizeText(body.category, 40) ?? 'system',
      title,
      body: sanitizeText(body.body, 2000) ?? undefined,
      link: sanitizeText(body.link, 400) ?? undefined,
      entityType: sanitizeText(body.entity_type, 40) ?? undefined,
      entityId: sanitizeText(body.entity_id, 80) ?? undefined,
      resumeId: body.resume_id ?? undefined,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
