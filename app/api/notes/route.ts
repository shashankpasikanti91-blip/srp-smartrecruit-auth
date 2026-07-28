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
import { isNoteVisibility } from '@/lib/noteConstants'

const MAX_BODY = 8000

function noteSelect(extraWhere = '') {
  return `SELECT id, tenant_id, entity_type, entity_id, category, body,
            author_user_id, author_email, author_name, created_at, updated_at,
            is_deleted, is_pinned, visibility, mentions, attachments, edited_at
     FROM entity_notes
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND is_deleted = FALSE
     ${extraWhere}
     ORDER BY is_pinned DESC, created_at DESC`
}

/** GET /api/notes?entityType=&entityId=&limit=&q=&visibility= */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const entityType = req.nextUrl.searchParams.get('entityType') ?? ''
  const entityId = req.nextUrl.searchParams.get('entityId') ?? ''
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50))
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
  const visibilityFilter = req.nextUrl.searchParams.get('visibility') ?? ''

  if (!isNoteEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }

  const owned = await assertEntityInTenant(ctx.tenantId, entityType, entityId)
  if (!owned) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const params: unknown[] = [ctx.tenantId, entityType, entityId]
  let extra = ''
  let idx = 4

  extra += ` AND (visibility = 'team' OR author_user_id = $${idx} OR author_user_id IS NULL)`
  params.push(ctx.userId)
  idx++

  if (visibilityFilter && isNoteVisibility(visibilityFilter)) {
    extra += ` AND visibility = $${idx}`
    params.push(visibilityFilter)
    idx++
  }

  if (q) {
    extra += ` AND (LOWER(body) LIKE $${idx} OR LOWER(COALESCE(author_name,'')) LIKE $${idx})`
    params.push(`%${q}%`)
    idx++
  }

  extra += ` LIMIT $${idx}`
  params.push(limit)

  let rows: EntityNoteRow[] = []
  try {
    const res = await pool.query<EntityNoteRow>(noteSelect(extra), params)
    rows = res.rows
  } catch {
    const fallback = await pool.query<EntityNoteRow>(
      `SELECT id, tenant_id, entity_type, entity_id, category, body,
              author_user_id, author_email, author_name, created_at, updated_at, is_deleted
       FROM entity_notes
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND is_deleted = FALSE
       ORDER BY created_at DESC LIMIT $4`,
      [ctx.tenantId, entityType, entityId, limit],
    )
    rows = fallback.rows
  }

  return NextResponse.json({ notes: rows, categories: NOTE_CATEGORY_LABELS })
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
    visibility?: string
    mentions?: string[]
    attachments?: unknown[]
    is_pinned?: boolean
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
  const visibility = body.visibility ?? 'team'

  if (!isNoteEntityType(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }
  if (!isValidUUID(entityId)) {
    return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
  }
  if (!isNoteCategory(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!isNoteVisibility(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
  }
  if (!text) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Note too long (max ${MAX_BODY} chars)` }, { status: 400 })
  }

  const owned = await assertEntityInTenant(ctx.tenantId, entityType as NoteEntityType, entityId)
  if (!owned) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const mentions = Array.isArray(body.mentions) ? body.mentions.slice(0, 20) : []
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : []

  try {
    const { rows } = await pool.query<EntityNoteRow>(
      `INSERT INTO entity_notes
         (tenant_id, entity_type, entity_id, category, body, author_user_id,
          author_email, author_name, visibility, mentions, attachments, is_pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
       RETURNING id, tenant_id, entity_type, entity_id, category, body,
                 author_user_id, author_email, author_name, created_at, updated_at,
                 is_deleted, is_pinned, visibility, mentions, attachments, edited_at`,
      [
        ctx.tenantId,
        entityType,
        entityId,
        category as NoteCategory,
        text,
        ctx.userId,
        ctx.userEmail,
        ctx.session.user?.name ?? null,
        visibility,
        JSON.stringify(mentions),
        JSON.stringify(attachments),
        Boolean(body.is_pinned),
      ],
    )
    return NextResponse.json({ ok: true, note: rows[0] }, { status: 201 })
  } catch {
    const { rows } = await pool.query<EntityNoteRow>(
      `INSERT INTO entity_notes
         (tenant_id, entity_type, entity_id, category, body, author_user_id, author_email, author_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, tenant_id, entity_type, entity_id, category, body,
                 author_user_id, author_email, author_name, created_at, updated_at, is_deleted`,
      [
        ctx.tenantId, entityType, entityId, category as NoteCategory, text,
        ctx.userId, ctx.userEmail, ctx.session.user?.name ?? null,
      ],
    )
    return NextResponse.json({ ok: true, note: rows[0] }, { status: 201 })
  }
}

/** PATCH /api/notes — edit, pin, delete */
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    noteId?: string
    action?: string
    body?: string
    category?: string
    visibility?: string
    is_pinned?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const noteId = body.noteId ?? ''
  if (!isValidUUID(noteId)) {
    return NextResponse.json({ error: 'Invalid noteId' }, { status: 400 })
  }

  const { rows } = await pool.query<{
    author_user_id: string | null
    body: string
    category: string
  }>(
    `SELECT author_user_id, body, category FROM entity_notes
     WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE LIMIT 1`,
    [noteId, ctx.tenantId],
  )
  if (!rows[0]) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const isAuthor = rows[0].author_user_id === ctx.userId
  const isAdmin = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'

  if (body.action === 'delete') {
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

  if (body.action === 'edit') {
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Not allowed to edit this note' }, { status: 403 })
    }
    const text = (body.body ?? '').trim()
    if (!text) return NextResponse.json({ error: 'Note body required' }, { status: 400 })
    const category = body.category && isNoteCategory(body.category) ? body.category : rows[0].category

    const sets = ['body = $1', 'category = $2', 'updated_at = NOW()', 'edited_at = NOW()']
    const vals: unknown[] = [text, category]
    let vi = 3

    if (body.visibility && isNoteVisibility(body.visibility)) {
      sets.push(`visibility = $${vi}`)
      vals.push(body.visibility)
      vi++
    }
    if (body.is_pinned !== undefined) {
      sets.push(`is_pinned = $${vi}`)
      vals.push(Boolean(body.is_pinned))
      vi++
    }

    vals.push(noteId, ctx.tenantId)
    try {
      const { rows: updated } = await pool.query<EntityNoteRow>(
        `UPDATE entity_notes SET ${sets.join(', ')}
         WHERE id = $${vi} AND tenant_id = $${vi + 1}
         RETURNING id, tenant_id, entity_type, entity_id, category, body,
                   author_user_id, author_email, author_name, created_at, updated_at,
                   is_deleted, is_pinned, visibility, mentions, attachments, edited_at`,
        vals,
      )
      return NextResponse.json({ ok: true, note: updated[0] })
    } catch {
      await pool.query(
        `UPDATE entity_notes SET body = $1, category = $2, updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [text, category, noteId, ctx.tenantId],
      )
      return NextResponse.json({ ok: true })
    }
  }

  if (body.action === 'pin') {
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }
    try {
      await pool.query(
        `UPDATE entity_notes SET is_pinned = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [Boolean(body.is_pinned), noteId, ctx.tenantId],
      )
    } catch {
      return NextResponse.json({ error: 'Pin not supported — run migrate_v31' }, { status: 501 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
