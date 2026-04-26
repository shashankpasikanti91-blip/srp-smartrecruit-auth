/**
 * app/api/portal-search/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxy endpoint for portal-based candidate search (Naukri, Monster, Shine).
 *
 * GET  /api/portal-search        — list past search history for this tenant
 * POST /api/portal-search        — run a new search
 * POST /api/portal-search/import — import selected profiles as candidates
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }             from '@/lib/tenant'
import type { TenantContext }        from '@/lib/tenant'
import { pool }                      from '@/lib/db'
import { logAudit }                  from '@/lib/audit'
import { searchPortal }              from '@/lib/portals'
import type { PortalSearchQuery }    from '@/lib/portals'

// Short ID generator: PSR-XXXXXXXX
function newSearchId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'PSR-'
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// ── GET — search history ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'boolean_search.use')
  if (ctx instanceof NextResponse) return ctx

  const url  = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const limit = 20
  const offset = (page - 1) * limit

  const { rows } = await pool.query(
    `SELECT ps.id, ps.short_id, ps.portal, ps.query_text, ps.filters,
            ps.total_found, ps.imported_count, ps.created_at,
            au.name AS run_by
     FROM portal_searches ps
     LEFT JOIN auth_users au ON au.id = ps.user_id
     WHERE ps.tenant_id = $1
     ORDER BY ps.created_at DESC
     LIMIT $2 OFFSET $3`,
    [ctx.tenantId, limit, offset]
  )

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM portal_searches WHERE tenant_id = $1`,
    [ctx.tenantId]
  )

  return NextResponse.json({ searches: rows, total: Number(countRows[0].total), page })
}

// ── POST — run new search ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'boolean_search.use')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    portal:      string
    query:       string
    location?:   string
    exp_min?:    number
    exp_max?:    number
    salary_min?: number
    salary_max?: number
    notice?:     string
    limit?:      number
    offset?:     number
    job_title?:  string
    import_selected?: Array<{ portal_id: string; name: string; email?: string | null; phone?: string | null; headline?: string | null; current_company?: string | null; location?: string | null; experience_years?: number | null; skills?: string[]; summary?: string | null }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { portal, query, import_selected } = body

  // ── Import action (second step after showing results) ──
  if (import_selected && Array.isArray(import_selected)) {
    return handleImport(ctx, body.portal ?? '', import_selected, body.query ?? '')
  }

  // ── Validate ──────────────────────────────────────────
  if (!portal || !query?.trim()) {
    return NextResponse.json({ error: '`portal` and `query` are required' }, { status: 422 })
  }

  const SUPPORTED_PORTALS = ['naukri', 'monster', 'shine']
  if (!SUPPORTED_PORTALS.includes(portal)) {
    return NextResponse.json({
      error: `Portal '${portal}' is not supported. Supported: ${SUPPORTED_PORTALS.join(', ')}`,
    }, { status: 422 })
  }

  const searchQuery: PortalSearchQuery = {
    query:      query.trim(),
    location:   body.location,
    exp_min:    body.exp_min,
    exp_max:    body.exp_max,
    salary_min: body.salary_min,
    salary_max: body.salary_max,
    notice:     body.notice,
    limit:      Math.min(body.limit ?? 20, 50),
    offset:     body.offset ?? 0,
    job_title:  body.job_title,
  }

  try {
    const result = await searchPortal(ctx.tenantId, portal, searchQuery)

    // Save to search history
    const shortId = newSearchId()
    const { rows: saved } = await pool.query(
      `INSERT INTO portal_searches
           (short_id, tenant_id, user_id, portal, query_text, filters, results, total_found)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, short_id`,
      [
        shortId,
        ctx.tenantId,
        ctx.userId,
        portal,
        query.trim(),
        JSON.stringify({ location: body.location, exp_min: body.exp_min, exp_max: body.exp_max }),
        JSON.stringify(result.profiles),
        result.total,
      ]
    )

    await logAudit({
      userId:       ctx.userId,
      userEmail:    ctx.userEmail,
      tenantId:     ctx.tenantId,
      action:       'portal_search',
      resourceType: 'portal_searches',
      resourceId:   saved[0].id,
      details:      { portal, query: query.trim(), found: result.total },
    })

    return NextResponse.json({
      search_id:  saved[0].id,
      short_id:   saved[0].short_id,
      portal,
      query,
      profiles:   result.profiles,
      total:      result.total,
      page:       result.page,
      has_more:   result.has_more,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[portal-search] Search error:', msg)
    // Distinguish credential vs network errors
    if (msg.includes('No active credentials')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    return NextResponse.json({ error: `Portal search failed: ${msg}` }, { status: 502 })
  }
}

// ── Import selected profiles as candidates in this tenant ─────────────────────

async function handleImport(
  ctx: TenantContext,
  portal: string,
  profiles: Array<{
    portal_id: string; name: string; email?: string | null; phone?: string | null
    headline?: string | null; current_company?: string | null; location?: string | null
    experience_years?: number | null; skills?: string[]; summary?: string | null
  }>,
  query: string
) {
  if (!profiles.length) {
    return NextResponse.json({ error: 'No profiles provided to import' }, { status: 422 })
  }

  const imported: string[] = []
  const skipped: string[] = []

  for (const p of profiles) {
    // Deduplicate by email within tenant
    if (p.email) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM resumes WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
        [ctx.tenantId, p.email.toLowerCase()]
      )
      if (existing.length) { skipped.push(p.portal_id); continue }
    }

    const skillsText = Array.isArray(p.skills) ? p.skills.join(', ') : ''
    const summaryText = [
      p.headline        ? `Role: ${p.headline}`                     : '',
      p.current_company ? `Company: ${p.current_company}`           : '',
      p.experience_years != null ? `Experience: ${p.experience_years} years` : '',
      p.summary         ? `\n${p.summary}`                          : '',
    ].filter(Boolean).join(' | ')

    await pool.query(
      `INSERT INTO resumes
           (tenant_id, name, email, phone, extracted_text, skills, summary, source,
            location, experience_years, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new',NOW())`,
      [
        ctx.tenantId,
        p.name,
        p.email?.toLowerCase() ?? null,
        p.phone ?? null,
        summaryText,
        skillsText,
        p.summary ?? null,
        `${portal}_import`,
        p.location ?? null,
        p.experience_years ?? null,
      ]
    )
    imported.push(p.portal_id)
  }

  // Update imported_count on portal_searches if search_id available
  // (skipped for simplicity — would need search_id passed in body)

  await logAudit({
    userId:       ctx.userId,
    userEmail:    ctx.userEmail,
    tenantId:     ctx.tenantId,
    action:       'portal_import',
    resourceType: 'resumes',
    details:      { portal, imported: imported.length, skipped: skipped.length, query },
  })

  return NextResponse.json({ imported: imported.length, skipped: skipped.length })
}
