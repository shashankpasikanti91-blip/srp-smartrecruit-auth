import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const bucket = sanitizeText(new URL(req.url).searchParams.get('bucket'), 20) ?? 'all'
  const mineOnly = new URL(req.url).searchParams.get('mine') === '1'
  const countsOnly = new URL(req.url).searchParams.get('counts') === '1'
  const now = new Date()
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999)

  if (countsOnly && mineOnly) {
    const base = ['f.tenant_id = $1', 'f.user_id = $2']
    const baseParams: unknown[] = [ctx.tenantId, ctx.userId]
    const countFor = async (extra: string, extraParams: unknown[]) => {
      const { rows } = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM follow_ups f WHERE ${base.join(' AND ')} AND ${extra}`,
        [...baseParams, ...extraParams]
      )
      return parseInt(rows[0]?.c ?? '0', 10)
    }
    const counts = {
      overdue: await countFor(`f.status = 'pending' AND f.due_at < $3`, [now.toISOString()]),
      today: await countFor(`f.status = 'pending' AND f.due_at >= $3 AND f.due_at <= $4`, [startOfDay.toISOString(), endOfDay.toISOString()]),
      upcoming: await countFor(`f.status = 'pending' AND f.due_at > $3`, [endOfDay.toISOString()]),
      done: await countFor(`f.status = 'done'`, []),
    }
    return NextResponse.json({ counts })
  }

  const conditions = ['f.tenant_id = $1']
  const params: unknown[] = [ctx.tenantId]
  let idx = 2

  if (mineOnly) {
    conditions.push(`f.user_id = $${idx}`)
    params.push(ctx.userId)
    idx++
  }

  const resumeId = new URL(req.url).searchParams.get('resume_id')
  if (resumeId && isValidUUID(resumeId)) {
    conditions.push(`f.resume_id = $${idx}`)
    params.push(resumeId)
    idx++
  }

  if (bucket === 'overdue') {
    conditions.push(`f.status = 'pending' AND f.due_at < $${idx}`)
    params.push(now.toISOString())
    idx++
  } else if (bucket === 'today') {
    conditions.push(`f.status = 'pending' AND f.due_at >= $${idx} AND f.due_at <= $${idx + 1}`)
    params.push(startOfDay.toISOString(), endOfDay.toISOString())
    idx += 2
  } else if (bucket === 'upcoming') {
    conditions.push(`f.status = 'pending' AND f.due_at > $${idx}`)
    params.push(endOfDay.toISOString())
    idx++
  } else if (bucket === 'done') {
    conditions.push(`f.status = 'done'`)
  }

  const { rows } = await pool.query(
    `SELECT f.*, r.candidate_name, r.short_id AS candidate_short_id
     FROM follow_ups f
     LEFT JOIN resumes r ON r.id = f.resume_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.due_at ASC
     LIMIT 200`,
    params
  )

  return NextResponse.json({ follow_ups: rows, bucket })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const title = sanitizeText(body.title, 200)
  const due_at = body.due_at as string
  if (!title || !due_at) return NextResponse.json({ error: 'title and due_at required' }, { status: 400 })

  let resume_id = body.resume_id || null
  if (resume_id && !isValidUUID(resume_id)) return NextResponse.json({ error: 'Invalid resume_id' }, { status: 400 })

  const { rows } = await pool.query(
    `INSERT INTO follow_ups
       (tenant_id, resume_id, submission_id, user_id, channel, title, notes, due_at, status, candidate_response)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      ctx.tenantId,
      resume_id,
      body.submission_id && isValidUUID(body.submission_id) ? body.submission_id : null,
      ctx.userId,
      sanitizeText(body.channel, 20) ?? 'call',
      title,
      sanitizeText(body.notes, 2000),
      due_at,
      'pending',
      sanitizeText(body.candidate_response, 2000),
    ]
  )

  return NextResponse.json({ follow_up: rows[0] }, { status: 201 })
}
