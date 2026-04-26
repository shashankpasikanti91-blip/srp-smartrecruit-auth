import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }            from '@/lib/tenant'
import { pool }                     from '@/lib/db'
import { sanitizeEmail, sanitizeText, sanitizeStringArray, sanitizePositiveInt, isValidUUID } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { searchParams } = new URL(req.url)
    const q         = sanitizeText(searchParams.get('q'), 200) ?? ''
    const stage     = sanitizeText(searchParams.get('stage'), 50) ?? ''
    const match     = sanitizeText(searchParams.get('match'), 50) ?? ''
    const jobId     = searchParams.get('job_id') ?? ''
    const skill     = sanitizeText(searchParams.get('skill'), 100) ?? ''
    const dateRange = sanitizeText(searchParams.get('date_range'), 20) ?? ''
    const limit     = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100))

    // Validate jobId if provided
    if (jobId && !isValidUUID(jobId)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 })
    }

    const conditions: string[] = ['r.tenant_id = $1']
    const params: unknown[] = [ctx.tenantId]
    let idx = 2

    if (q) { conditions.push(`(r.candidate_name ILIKE $${idx} OR r.candidate_email ILIKE $${idx} OR r.short_id ILIKE $${idx})`); params.push(`%${q}%`); idx++ }
    if (stage) { conditions.push(`r.pipeline_stage = $${idx}`); params.push(stage); idx++ }
    if (match)  { conditions.push(`r.match_category = $${idx}`); params.push(match); idx++ }
    if (jobId)  { conditions.push(`r.job_post_id = $${idx}`); params.push(jobId); idx++ }
    if (skill)  { conditions.push(`EXISTS (SELECT 1 FROM unnest(r.ai_skills) s(sk) WHERE s.sk ILIKE $${idx})`); params.push(`%${skill}%`); idx++ }
    if (dateRange) {
      const now = new Date()
      if (dateRange === 'today') {
        const today = now.toISOString().split('T')[0]
        conditions.push(`r.created_at::date = $${idx}::date`); params.push(today); idx++
      } else if (dateRange === '7days') {
        const d = new Date(now); d.setDate(d.getDate() - 7)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      } else if (dateRange === '30days') {
        const d = new Date(now); d.setDate(d.getDate() - 30)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      }
    }

    const where = conditions.join(' AND ')
    const sql = `
      SELECT r.id, r.short_id, r.candidate_name, r.candidate_email, r.candidate_phone,
             r.ai_score, r.match_category, r.pipeline_stage, r.status, r.reviewer_notes,
             r.ai_summary, r.ai_skills, r.job_post_id, r.raw_text, r.file_name, r.created_at,
             jp.id AS jp_id, jp.short_id AS jp_short_id, jp.title AS jp_title, jp.company AS jp_company
      FROM resumes r
      LEFT JOIN job_posts jp ON jp.id = r.job_post_id
      WHERE ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx}
    `
    params.push(limit)
    const { rows } = await pool.query(sql, params)
    const candidates = rows.map(r => ({
      ...r,
      job_posts: r.jp_id ? { id: r.jp_id, short_id: r.jp_short_id, title: r.jp_title, company: r.jp_company } : null,
    }))

    const stageRes = await pool.query<{ pipeline_stage: string }>(
      'SELECT pipeline_stage FROM resumes WHERE tenant_id = $1',
      [ctx.tenantId]
    )
    const counts: Record<string, number> = {}
    for (const row of stageRes.rows) {
      counts[row.pipeline_stage] = (counts[row.pipeline_stage] ?? 0) + 1
    }

    // match counts and top skills from ALL candidates (not filtered)
    const globalRes = await pool.query<{ match_category: string | null; ai_skills: string[] }>(
      'SELECT match_category, ai_skills FROM resumes WHERE tenant_id = $1',
      [ctx.tenantId]
    )
    const matchCounts: Record<string, number> = {}
    const skillMap: Record<string, number> = {}
    for (const row of globalRes.rows) {
      if (row.match_category) matchCounts[row.match_category] = (matchCounts[row.match_category] ?? 0) + 1
      if (Array.isArray(row.ai_skills)) {
        for (const s of row.ai_skills) {
          if (s) skillMap[s] = (skillMap[s] ?? 0) + 1
        }
      }
    }
    const topSkills = Object.entries(skillMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count }))

    return NextResponse.json({ candidates, stageCounts: counts, matchCounts, topSkills })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const candidate_name    = sanitizeText(body.candidate_name, 200)
    const candidate_email   = sanitizeEmail(body.candidate_email)
    const candidate_phone   = sanitizeText(body.candidate_phone, 50)
    const ai_skills         = sanitizeStringArray(body.ai_skills, 100, 200)
    const ai_score          = sanitizePositiveInt(body.ai_score, 100)
    const ai_summary        = sanitizeText(body.ai_summary, 5000)
    const raw_text          = sanitizeText(body.raw_text, 100000)
    const file_name         = sanitizeText(body.file_name, 255)
    const file_size_bytes   = sanitizePositiveInt(body.file_size_bytes, 52428800) // 50 MB max
    const pipeline_stage    = sanitizeText(body.pipeline_stage, 50) ?? 'sourced'

    if (!candidate_name && !candidate_email) {
      return NextResponse.json({ error: 'candidate_name or candidate_email required' }, { status: 400 })
    }

    // Validate job_post_id belongs to this tenant
    let job_post_id: string | null = null
    if (body.job_post_id) {
      if (!isValidUUID(body.job_post_id)) {
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      }
      const jpCheck = await pool.query(
        'SELECT id FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [body.job_post_id, ctx.tenantId]
      )
      if (!jpCheck.rows.length) {
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      }
      job_post_id = body.job_post_id
    }

    // Duplicate check by email within this tenant
    if (candidate_email) {
      const dup = await pool.query<{ id: string; short_id: string; candidate_name: string }>(
        `SELECT id, short_id, candidate_name FROM resumes
         WHERE tenant_id = $1 AND candidate_email = $2 LIMIT 1`,
        [ctx.tenantId, candidate_email]
      )
      if (dup.rows.length) {
        return NextResponse.json({
          error: 'Duplicate: a candidate with this email already exists in this workspace',
          existing: { id: dup.rows[0].id, short_id: dup.rows[0].short_id, name: dup.rows[0].candidate_name },
          is_duplicate: true,
        }, { status: 409 })
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO resumes
         (tenant_id, user_id, candidate_name, candidate_email, candidate_phone,
          ai_skills, ai_score, ai_summary, job_post_id, pipeline_stage,
          raw_text, file_name, file_size_bytes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
       RETURNING *`,
      [ctx.tenantId, ctx.userId, candidate_name, candidate_email,
       candidate_phone, ai_skills, ai_score, ai_summary,
       job_post_id, pipeline_stage, raw_text, file_name, file_size_bytes]
    )

    return NextResponse.json({ candidate: rows[0] }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/candidates POST]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
