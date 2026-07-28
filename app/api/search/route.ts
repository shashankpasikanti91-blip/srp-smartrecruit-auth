import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'

export type SearchHit = {
  type: string
  id: string
  short_id?: string | null
  title: string
  subtitle?: string | null
  href: string
}

/** GET /api/search?q= — universal tenant-scoped search */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const mode = req.nextUrl.searchParams.get('mode') ?? 'search'

  if (mode === 'recent') {
    try {
      const { rows } = await pool.query(
        `SELECT id, query, result_type, result_id, result_label, created_at
         FROM global_search_history
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY created_at DESC LIMIT 12`,
        [ctx.tenantId, ctx.userId],
      )
      return NextResponse.json({ recent: rows })
    } catch {
      return NextResponse.json({ recent: [] })
    }
  }

  if (mode === 'saved') {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, query, filters, created_at
         FROM saved_searches
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 30`,
        [ctx.tenantId, ctx.userId],
      )
      return NextResponse.json({ saved: rows })
    } catch {
      return NextResponse.json({ saved: [] })
    }
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [], query: q })
  }

  const like = `%${q.toLowerCase()}%`
  const results: SearchHit[] = []

  const push = (rows: Record<string, unknown>[], map: (r: Record<string, unknown>) => SearchHit | null) => {
    for (const r of rows) {
      const hit = map(r)
      if (hit) results.push(hit)
    }
  }

  await Promise.all([
    pool.query(
      `SELECT id, short_id, candidate_name, candidate_email, pipeline_stage
       FROM resumes
       WHERE tenant_id = $1
         AND (
           LOWER(candidate_name) LIKE $2
           OR LOWER(COALESCE(candidate_email,'')) LIKE $2
           OR LOWER(COALESCE(short_id,'')) LIKE $2
           OR LOWER(COALESCE(candidate_phone,'')) LIKE $2
         )
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 8`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'candidate',
      id: String(row.id),
      short_id: row.short_id as string,
      title: String(row.candidate_name ?? 'Candidate'),
      subtitle: [row.short_id, row.candidate_email, row.pipeline_stage].filter(Boolean).join(' · '),
      href: `/dashboard/candidates/${row.id}`,
    }))).catch(() => null),

    pool.query(
      `SELECT id, short_id, title, company, status, location
       FROM job_posts
       WHERE tenant_id = $1
         AND (
           LOWER(title) LIKE $2
           OR LOWER(COALESCE(company,'')) LIKE $2
           OR LOWER(COALESCE(short_id,'')) LIKE $2
           OR LOWER(COALESCE(location,'')) LIKE $2
         )
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 8`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'job',
      id: String(row.id),
      short_id: row.short_id as string,
      title: String(row.title ?? 'Job'),
      subtitle: [row.short_id, row.company, row.status].filter(Boolean).join(' · '),
      href: `/dashboard/jobs/${row.id}`,
    }))).catch(() => null),

    pool.query(
      `SELECT id, name, industry, is_active
       FROM clients
       WHERE tenant_id = $1 AND is_active = TRUE
         AND (
           LOWER(name) LIKE $2
           OR LOWER(COALESCE(industry,'')) LIKE $2
           OR LOWER(COALESCE(contact_name,'')) LIKE $2
           OR LOWER(COALESCE(contact_email,'')) LIKE $2
         )
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'client',
      id: String(row.id),
      title: String(row.name ?? 'Client'),
      subtitle: [row.industry, row.is_active ? 'Active' : 'Inactive'].filter(Boolean).join(' · '),
      href: `/dashboard?tab=clients`,
    }))).catch(() => null),

    pool.query(
      `SELECT s.id, s.short_id, s.stage, s.client_name, s.applying_for, r.candidate_name
       FROM submissions s
       LEFT JOIN resumes r ON r.id = s.resume_id
       WHERE s.tenant_id = $1
         AND (
           LOWER(COALESCE(s.short_id,'')) LIKE $2
           OR LOWER(COALESCE(s.client_name,'')) LIKE $2
           OR LOWER(COALESCE(s.applying_for,'')) LIKE $2
           OR LOWER(COALESCE(r.candidate_name,'')) LIKE $2
         )
       ORDER BY s.updated_at DESC
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'submission',
      id: String(row.id),
      short_id: row.short_id as string,
      title: String(row.candidate_name ?? row.applying_for ?? 'Submission'),
      subtitle: [row.short_id, row.client_name, row.stage].filter(Boolean).join(' · '),
      href: `/dashboard?tab=submissions`,
    }))).catch(() => null),

    pool.query(
      `SELECT i.id, i.short_id, i.status, i.scheduled_at, r.candidate_name, jp.title AS job_title
       FROM interviews i
       LEFT JOIN resumes r ON r.id = i.resume_id
       LEFT JOIN job_posts jp ON jp.id = i.job_post_id
       WHERE i.tenant_id = $1
         AND (
           LOWER(COALESCE(i.short_id,'')) LIKE $2
           OR LOWER(COALESCE(r.candidate_name,'')) LIKE $2
           OR LOWER(COALESCE(jp.title,'')) LIKE $2
         )
       ORDER BY i.scheduled_at DESC NULLS LAST
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'interview',
      id: String(row.id),
      short_id: row.short_id as string,
      title: String(row.candidate_name ?? 'Interview'),
      subtitle: [row.short_id, row.job_title, row.status].filter(Boolean).join(' · '),
      href: `/dashboard?tab=interviews`,
    }))).catch(() => null),

    pool.query(
      `SELECT o.id, o.short_id, o.status, r.candidate_name
       FROM offer_cases o
       LEFT JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1
         AND (
           LOWER(COALESCE(o.short_id,'')) LIKE $2
           OR LOWER(COALESCE(r.candidate_name,'')) LIKE $2
         )
       ORDER BY o.updated_at DESC
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'offer',
      id: String(row.id),
      short_id: row.short_id as string,
      title: String(row.candidate_name ?? 'Offer'),
      subtitle: [row.short_id, row.status].filter(Boolean).join(' · '),
      href: `/dashboard?tab=selected`,
    }))).catch(() => null),

    pool.query(
      `SELECT id, category, LEFT(body, 120) AS body, entity_type, entity_id
       FROM entity_notes
       WHERE tenant_id = $1 AND is_deleted = FALSE
         AND LOWER(body) LIKE $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => {
      const entityType = String(row.entity_type ?? '')
      const entityId = String(row.entity_id ?? '')
      const href =
        entityType === 'candidate' ? `/dashboard/candidates/${entityId}`
        : entityType === 'job' ? `/dashboard/jobs/${entityId}`
        : `/dashboard?tab=candidates`
      return {
        type: 'note',
        id: String(row.id),
        title: `Note · ${row.category}`,
        subtitle: String(row.body ?? ''),
        href,
      }
    })).catch(() => null),

    pool.query(
      `SELECT d.id, d.file_name, d.doc_type, d.resume_id, r.candidate_name
       FROM candidate_documents d
       JOIN resumes r ON r.id = d.resume_id
       WHERE r.tenant_id = $1
         AND (
           LOWER(COALESCE(d.file_name,'')) LIKE $2
           OR LOWER(COALESCE(d.doc_type,'')) LIKE $2
           OR LOWER(COALESCE(r.candidate_name,'')) LIKE $2
         )
       ORDER BY d.created_at DESC
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'document',
      id: String(row.id),
      title: String(row.file_name ?? 'Document'),
      subtitle: [row.candidate_name, row.doc_type].filter(Boolean).join(' · '),
      href: `/dashboard/candidates/${row.resume_id}`,
    }))).catch(() => null),

    pool.query(
      `SELECT tm.user_id, u.name, u.email, tm.role
       FROM tenant_members tm
       JOIN auth_users u ON u.id = tm.user_id
       WHERE tm.tenant_id = $1 AND tm.is_active = TRUE
         AND (
           LOWER(COALESCE(u.name,'')) LIKE $2
           OR LOWER(u.email) LIKE $2
         )
       LIMIT 5`,
      [ctx.tenantId, like],
    ).then(r => push(r.rows, row => ({
      type: 'recruiter',
      id: String(row.user_id),
      title: String(row.name || row.email),
      subtitle: [row.email, row.role].filter(Boolean).join(' · '),
      href: `/dashboard?tab=recruiters`,
    }))).catch(() => null),
  ])

  // Soft ranking: prefer exact short_id / name prefix
  const ql = q.toLowerCase()
  results.sort((a, b) => {
    const as = (a.short_id ?? '').toLowerCase() === ql || a.title.toLowerCase().startsWith(ql) ? 0 : 1
    const bs = (b.short_id ?? '').toLowerCase() === ql || b.title.toLowerCase().startsWith(ql) ? 0 : 1
    return as - bs
  })

  return NextResponse.json({
    query: q,
    results: results.slice(0, 40),
    total: results.length,
  })
}

/** POST /api/search — record history or save search */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'record') {
    const query = sanitizeText(body.query, 200)
    if (!query) return NextResponse.json({ ok: true })
    try {
      await pool.query(
        `INSERT INTO global_search_history
           (tenant_id, user_id, query, result_type, result_id, result_label)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          ctx.tenantId,
          ctx.userId,
          query,
          sanitizeText(body.result_type, 40),
          sanitizeText(body.result_id, 80),
          sanitizeText(body.result_label, 200),
        ],
      )
    } catch { /* table may not exist yet */ }
    return NextResponse.json({ ok: true })
  }

  if (action === 'save') {
    const name = sanitizeText(body.name, 80)
    const query = sanitizeText(body.query, 200)
    if (!name || !query) {
      return NextResponse.json({ error: 'name and query required' }, { status: 400 })
    }
    try {
      await pool.query(
        `INSERT INTO saved_searches (tenant_id, user_id, name, query, filters, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          name,
          query,
          JSON.stringify(body.filters ?? {}),
        ],
      )
    } catch (e) {
      return NextResponse.json({
        error: e instanceof Error ? e.message : 'Could not save search — run migrate_v32',
      }, { status: 501 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
