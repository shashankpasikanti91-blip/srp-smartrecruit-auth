import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import {
  assertEntityInTenant,
  isNoteCategory,
  isNoteEntityType,
  NOTE_CATEGORY_LABELS,
  type EntityNoteRow,
  type NoteCategory,
  type NoteEntityType,
} from '@/lib/entityNotes'

const MAX_BODY = 4000

/** GET /api/notes?entityType=&entityId=&limit= */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const entityType = req.nextUrl.searchParams.get('entityType') ?? ''
  const entityId = req.nextUrl.searchParams.get('entityId') ?? ''
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50))

  if (!isNoteEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }

  const owned = await assertEntityInTenant(ctx.tenantId, entityType, entityId)
  if (!owned) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const { rows } = await pool.query<EntityNoteRow>(
    `SELECT id, tenant_id, entity_type, entity_id, category, body,
            author_user_id, author_email, author_name, created_at, updated_at, is_deleted
     FROM entity_notes
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND is_deleted = FALSE
     ORDER BY created_at DESC
     LIMIT $4`,
    [ctx.tenantId, entityType, entityId, limit],
  )

  return NextResponse.json({
    notes: rows,
    categories: NOTE_CATEGORY_LABELS,
  })
}

/** POST /api/notes — create a note */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    entityType?: string
    entityId?: string
    category?: string
    body?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const entityType = body.entityType ?? ''
  const entityId = body.entityId ?? ''
  const category = (body.category ?? 'general') as string
  const text = (body.body ?? '').trim()

  if (!isNoteEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }
  if (!isNoteCategory(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!text) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Note too long (max ${MAX_BODY} chars)` }, { status: 400 })
  }

  const owned = await assertEntityInTenant(ctx.tenantId, entityType as NoteEntityType, entityId)
  if (!owned) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const { rows } = await pool.query<EntityNoteRow>(
    `INSERT INTO entity_notes
       (tenant_id, entity_type, entity_id, category, body, author_user_id, author_email, author_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, tenant_id, entity_type, entity_id, category, body,
               author_user_id, author_email, author_name, created_at, updated_at, is_deleted`,
    [
      ctx.tenantId,
      entityType,
      entityId,
      category as NoteCategory,
      text,
      ctx.userId,
      ctx.userEmail,
      ctx.session.user?.name ?? null,
    ],
  )

  return NextResponse.json({ ok: true, note: rows[0] }, { status: 201 })
}

/** PATCH /api/notes — soft-delete (author or admin/owner) */
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: { noteId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const noteId = body.noteId ?? ''
  if (!isValidUUID(noteId)) {
    return NextResponse.json({ error: 'Invalid noteId' }, { status: 400 })
  }
  if (body.action !== 'delete') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { rows } = await pool.query<{ author_user_id: string | null }>(
    `SELECT author_user_id FROM entity_notes
     WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE LIMIT 1`,
    [noteId, ctx.tenantId],
  )
  if (!rows[0]) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const isAuthor = rows[0].author_user_id === ctx.userId
  const isAdmin = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Not allowed to delete this note' }, { status: 403 })
  }

  await pool.query(
    `UPDATE entity_notes SET is_deleted = TRUE, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [noteId, ctx.tenantId],
  )

  return NextResponse.json({ ok: true })
}
