import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }            from '@/lib/tenant'
import { pool }                     from '@/lib/db'
import { sanitizeEmail, sanitizeText, sanitizeStringArray, sanitizePositiveInt, isValidUUID, sanitizeCandidateProfile } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'

/** pg sometimes returns JSONB as object; legacy TEXT/json columns may return a string. */
function parseJsonObject<T extends Record<string, unknown>>(v: unknown): T | null {
  if (v == null) return null
  if (typeof v === 'object' && !Array.isArray(v)) return v as T
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v) as unknown
      if (typeof o === 'object' && o !== null && !Array.isArray(o)) return o as T
    } catch { /* ignore */ }
  }
  return null
}

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
    const dateRange = sanitizeText(searchParams.get('date_range'), 30) ?? ''
    const hireType  = sanitizeText(searchParams.get('hire_type'), 40) ?? ''
    const source    = sanitizeText(searchParams.get('source'), 80) ?? ''
    const recruiter = searchParams.get('recruiter_id') ?? ''
    const client    = sanitizeText(searchParams.get('client'), 200) ?? ''
    const lifecycle = sanitizeText(searchParams.get('lifecycle'), 60) ?? ''
    const location  = sanitizeText(searchParams.get('location'), 200) ?? ''
    const visaType  = sanitizeText(searchParams.get('visa_type'), 80) ?? ''
    const dateFrom  = sanitizeText(searchParams.get('date_from'), 40) ?? ''
    const dateTo    = sanitizeText(searchParams.get('date_to'), 40) ?? ''
    const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit     = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
    const offset    = (page - 1) * limit
    const sortByRaw = sanitizeText(searchParams.get('sort'), 40) ?? 'created_at'
    const sortDir   = (searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'
    const SORT_MAP: Record<string, string> = {
      created_at: 'r.created_at',
      name: 'r.candidate_name',
      score: 'r.ai_score',
      stage: 'r.pipeline_stage',
      status: 'r.status',
      updated_at: 'r.updated_at',
    }
    const sortCol = SORT_MAP[sortByRaw] ?? 'r.created_at'

    if (jobId && !isValidUUID(jobId)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 })
    }
    if (recruiter && !isValidUUID(recruiter)) {
      return NextResponse.json({ error: 'Invalid recruiter_id' }, { status: 400 })
    }

    const conditions: string[] = ['r.tenant_id = $1']
    const params: unknown[] = [ctx.tenantId]
    let idx = 2

    if (q) {
      conditions.push(`(
        r.candidate_name ILIKE $${idx}
        OR r.candidate_email ILIKE $${idx}
        OR r.candidate_phone ILIKE $${idx}
        OR r.short_id ILIKE $${idx}
        OR COALESCE(r.candidate_profile->>'nric','') ILIKE $${idx}
        OR COALESCE(r.candidate_profile->>'id_document_reference','') ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(r.ai_skills) s(sk) WHERE s.sk ILIKE $${idx})
      )`)
      params.push(`%${q}%`); idx++
    }
    if (stage) { conditions.push(`r.pipeline_stage = $${idx}`); params.push(stage); idx++ }
    if (match)  { conditions.push(`r.match_category = $${idx}`); params.push(match); idx++ }
    if (jobId)  { conditions.push(`r.job_post_id = $${idx}`); params.push(jobId); idx++ }
    if (skill)  { conditions.push(`EXISTS (SELECT 1 FROM unnest(r.ai_skills) s(sk) WHERE s.sk ILIKE $${idx})`); params.push(`%${skill}%`); idx++ }
    if (hireType) {
      conditions.push(`LOWER(COALESCE(r.candidate_profile->>'hire_type','')) = LOWER($${idx})`)
      params.push(hireType); idx++
    }
    if (source) {
      conditions.push(`(r.source_type ILIKE $${idx} OR COALESCE(r.candidate_profile->>'source_channel','') ILIKE $${idx})`)
      params.push(`%${source}%`); idx++
    }
    if (recruiter) { conditions.push(`r.user_id = $${idx}`); params.push(recruiter); idx++ }
    if (client) {
      conditions.push(`(COALESCE(r.candidate_profile->>'client_name','') ILIKE $${idx} OR COALESCE(jp.company,'') ILIKE $${idx})`)
      params.push(`%${client}%`); idx++
    }
    if (lifecycle) {
      conditions.push(`LOWER(COALESCE(r.candidate_profile->>'lifecycle_status','')) = LOWER($${idx})`)
      params.push(lifecycle); idx++
    }
    if (location) {
      conditions.push(`(COALESCE(r.candidate_profile->>'current_location','') ILIKE $${idx} OR COALESCE(r.location,'') ILIKE $${idx})`)
      params.push(`%${location}%`); idx++
    }
    if (visaType) {
      conditions.push(`LOWER(COALESCE(r.candidate_profile->>'visa_type','')) = LOWER($${idx})`)
      params.push(visaType); idx++
    }
    if (dateFrom) {
      conditions.push(`r.created_at::date >= $${idx}::date`); params.push(dateFrom); idx++
    }
    if (dateTo) {
      conditions.push(`r.created_at::date <= $${idx}::date`); params.push(dateTo); idx++
    }
    if (dateRange && !dateFrom && !dateTo) {
      const now = new Date()
      const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
      if (dateRange === 'today' || dateRange === 'day') {
        const today = now.toISOString().split('T')[0]
        conditions.push(`r.created_at::date = $${idx}::date`); params.push(today); idx++
      } else if (dateRange === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1)
        conditions.push(`r.created_at::date = $${idx}::date`); params.push(y.toISOString().split('T')[0]); idx++
      } else if (dateRange === 'week' || dateRange === '7days' || dateRange === 'this_week') {
        const d = startOfDay(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      } else if (dateRange === 'last_week') {
        const end = startOfDay(now); end.setDate(end.getDate() - ((end.getDay() + 6) % 7))
        const start = new Date(end); start.setDate(start.getDate() - 7)
        conditions.push(`r.created_at >= $${idx} AND r.created_at < $${idx + 1}`)
        params.push(start.toISOString(), end.toISOString()); idx += 2
      } else if (dateRange === 'month' || dateRange === '30days' || dateRange === 'this_month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      } else if (dateRange === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 1)
        conditions.push(`r.created_at >= $${idx} AND r.created_at < $${idx + 1}`)
        params.push(start.toISOString(), end.toISOString()); idx += 2
      } else if (dateRange === 'year' || dateRange === '365days' || dateRange === 'this_year') {
        const d = new Date(now.getFullYear(), 0, 1)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      }
    }

    const where = conditions.join(' AND ')
    const countRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM resumes r
       LEFT JOIN job_posts jp ON jp.id = r.job_post_id
       WHERE ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0', 10) || 0

    const sql = `
      SELECT r.id, r.short_id, r.candidate_name, r.candidate_email, r.candidate_phone,
             r.ai_score, r.match_category, r.pipeline_stage, r.status, r.reviewer_notes,
             r.ai_summary, r.ai_skills, r.ai_screening_data, r.candidate_profile,
             r.job_post_id, r.user_id, r.raw_text, r.file_name, r.resume_original_path, r.source_type,
             r.created_at, r.updated_at, r.last_contacted_at,
             u.name AS upload_user_name, u.email AS upload_user_email,
             jp.id AS jp_id, jp.short_id AS jp_short_id, jp.title AS jp_title, jp.company AS jp_company
      FROM resumes r
      LEFT JOIN auth_users u ON u.id = r.user_id
      LEFT JOIN job_posts jp ON jp.id = r.job_post_id
      WHERE ${where}
      ORDER BY ${sortCol} ${sortDir} NULLS LAST
      LIMIT $${idx} OFFSET $${idx + 1}
    `
    params.push(limit, offset)
    const { rows } = await pool.query(sql, params)
    type Row = Record<string, unknown> & {
      jp_id?: string | null
      jp_short_id?: string | null
      jp_title?: string | null
      jp_company?: string | null
      upload_user_name?: string | null
      upload_user_email?: string | null
    }
    const candidates = rows.map(raw => {
      const r = raw as Row
      const {
        jp_id, jp_short_id, jp_title, jp_company,
        upload_user_name, upload_user_email,
        ...resume
      } = r
      const aiParsed = parseJsonObject(resume.ai_screening_data as unknown)
      const profParsed = parseJsonObject(resume.candidate_profile as unknown)
      const uploaded_by =
        upload_user_name || upload_user_email
          ? { name: upload_user_name ?? null, email: upload_user_email ?? null }
          : null
      return {
        ...resume,
        uploaded_by,
        ai_screening_data: aiParsed ?? (typeof resume.ai_screening_data === 'object' && resume.ai_screening_data !== null
          ? resume.ai_screening_data
          : null),
        candidate_profile: profParsed ?? {},
        job_posts: jp_id ? { id: jp_id, short_id: jp_short_id, title: jp_title, company: jp_company } : null,
      }
    })

    const stageRes = await pool.query<{ pipeline_stage: string; n: string }>(
      `SELECT COALESCE(pipeline_stage, 'sourced') AS pipeline_stage, COUNT(*)::text AS n
       FROM resumes WHERE tenant_id = $1
       GROUP BY 1`,
      [ctx.tenantId]
    )
    const counts: Record<string, number> = {}
    for (const row of stageRes.rows) {
      counts[row.pipeline_stage] = parseInt(row.n, 10)
    }

    // Aggregates via SQL — avoid loading all rows at 10k+ scale
    const matchRes = await pool.query<{ match_category: string; n: string }>(
      `SELECT match_category, COUNT(*)::text AS n
       FROM resumes WHERE tenant_id = $1 AND match_category IS NOT NULL
       GROUP BY 1`,
      [ctx.tenantId]
    )
    const matchCounts: Record<string, number> = {}
    for (const row of matchRes.rows) {
      matchCounts[row.match_category] = parseInt(row.n, 10)
    }

    const skillRes = await pool.query<{ skill: string; n: string }>(
      `SELECT sk AS skill, COUNT(*)::text AS n
       FROM resumes r, LATERAL unnest(COALESCE(r.ai_skills, ARRAY[]::text[])) AS sk
       WHERE r.tenant_id = $1 AND sk IS NOT NULL AND sk <> ''
       GROUP BY sk
       ORDER BY COUNT(*) DESC
       LIMIT 20`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] as { skill: string; n: string }[] }))
    const topSkills = skillRes.rows.map(r => ({ skill: r.skill, count: parseInt(r.n, 10) }))

    return NextResponse.json({
      candidates,
      stageCounts: counts,
      matchCounts,
      topSkills,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
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
    const candidate_profile = body.candidate_profile
      ? sanitizeCandidateProfile(body.candidate_profile)
      : null

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
      const dup = await pool.query<{
        id: string
        short_id: string
        candidate_name: string
        pipeline_stage: string
        status: string
        created_at: Date
        upload_user_name: string | null
        upload_user_email: string | null
      }>(
        `SELECT r.id, r.short_id, r.candidate_name, r.pipeline_stage, r.status, r.created_at,
                u.name AS upload_user_name, u.email AS upload_user_email
           FROM resumes r
           LEFT JOIN auth_users u ON u.id = r.user_id
          WHERE r.tenant_id = $1 AND r.candidate_email = $2
          LIMIT 1`,
        [ctx.tenantId, candidate_email]
      )
      if (dup.rows.length) {
        const row = dup.rows[0]
        const uploaded_by =
          row.upload_user_name || row.upload_user_email
            ? { name: row.upload_user_name, email: row.upload_user_email }
            : null
        return NextResponse.json({
          error: 'Duplicate: a candidate with this email already exists in this workspace',
          existing: {
            id: row.id,
            short_id: row.short_id,
            name: row.candidate_name,
            pipeline_stage: row.pipeline_stage,
            status: row.status,
            created_at: row.created_at,
            uploaded_by,
          },
          is_duplicate: true,
        }, { status: 409 })
      }
    }

    const status = body.status === 'reviewed' ? 'reviewed' : 'pending'

    const { rows } = await pool.query(
      `INSERT INTO resumes
         (tenant_id, user_id, candidate_name, candidate_email, candidate_phone,
          ai_skills, ai_score, ai_summary, job_post_id, pipeline_stage,
          raw_text, file_name, file_size_bytes, candidate_profile, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       RETURNING *`,
      [ctx.tenantId, ctx.userId, candidate_name, candidate_email,
       candidate_phone, ai_skills, ai_score, ai_summary,
       job_post_id, pipeline_stage, raw_text, file_name, file_size_bytes,
       candidate_profile ? JSON.stringify(candidate_profile) : '{}',
       status]
    )

    const cand = rows[0]
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      tenantId: ctx.tenantId,
      action: 'candidate_created',
      resourceType: 'candidate',
      resourceId: cand.short_id ?? cand.id,
      resumeId: cand.id,
      details: { name: cand.candidate_name, stage: pipeline_stage },
    })
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'candidate',
      entityId: cand.id,
      resumeId: cand.id,
      eventType: 'candidate_sourced',
      title: 'Candidate Sourced',
      detail: cand.candidate_name,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      meta: { pipeline_stage, job_post_id },
    })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: 'candidate',
      title: `Candidate added — ${cand.candidate_name}`,
      body: pipeline_stage ? `Stage: ${pipeline_stage}` : undefined,
      resumeId: cand.id,
      entityType: 'candidate',
      entityId: cand.id,
    })

    return NextResponse.json({ candidate: cand }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/candidates POST]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
