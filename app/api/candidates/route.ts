import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const q      = searchParams.get('q') ?? ''
    const stage  = searchParams.get('stage') ?? ''
    const match  = searchParams.get('match') ?? ''
    const jobId  = searchParams.get('job_id') ?? ''
    const skill  = searchParams.get('skill') ?? ''
    const limit  = parseInt(searchParams.get('limit') ?? '100')

    const userRes = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE email = $1',
      [session.user.email]
    )
    if (!userRes.rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userId = userRes.rows[0].id

    const conditions: string[] = ['r.user_id = $1']
    const params: unknown[] = [userId]
    let idx = 2

    if (q) { conditions.push(`(r.candidate_name ILIKE $${idx} OR r.candidate_email ILIKE $${idx})`); params.push(`%${q}%`); idx++ }
    if (stage) { conditions.push(`r.pipeline_stage = $${idx}`); params.push(stage); idx++ }
    if (match)  { conditions.push(`r.match_category = $${idx}`); params.push(match); idx++ }
    if (jobId)  { conditions.push(`r.job_post_id = $${idx}`); params.push(jobId); idx++ }
    if (skill)  { conditions.push(`EXISTS (SELECT 1 FROM unnest(r.ai_skills) s(sk) WHERE s.sk ILIKE $${idx})`); params.push(`%${skill}%`); idx++ }

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
      'SELECT pipeline_stage FROM resumes WHERE user_id = $1',
      [userId]
    )
    const counts: Record<string, number> = {}
    for (const row of stageRes.rows) {
      counts[row.pipeline_stage] = (counts[row.pipeline_stage] ?? 0) + 1
    }

    // match counts and top skills from ALL candidates (not filtered)
    const globalRes = await pool.query<{ match_category: string | null; ai_skills: string[] }>(
      'SELECT match_category, ai_skills FROM resumes WHERE user_id = $1',
      [userId]
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { candidate_name, candidate_email, candidate_phone, ai_skills, ai_score, ai_summary, job_post_id, pipeline_stage, raw_text, file_name, file_size_bytes } = body
    if (!candidate_name) {
      return NextResponse.json({ error: 'candidate_name required' }, { status: 400 })
    }

    const userRes = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE email = $1',
      [session.user.email]
    )
    if (!userRes.rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userId = userRes.rows[0].id

    const { rows } = await pool.query(
      `INSERT INTO resumes (user_id, candidate_name, candidate_email, candidate_phone, ai_skills, ai_score, ai_summary, job_post_id, pipeline_stage, raw_text, file_name, file_size_bytes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
       RETURNING *`,
      [userId, candidate_name, candidate_email ?? null, candidate_phone ?? null,
       ai_skills ?? [], ai_score ?? null, ai_summary ?? null,
       job_post_id ?? null, pipeline_stage ?? 'sourced',
       raw_text ?? null, file_name ?? null, file_size_bytes ?? null]
    )

    return NextResponse.json({ candidate: rows[0] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
