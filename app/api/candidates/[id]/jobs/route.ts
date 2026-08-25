import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let cand: { rows: { id: string; job_post_id: string | null }[] }
  try {
    cand = await pool.query(
      'SELECT id, job_post_id FROM resumes WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId]
    )
  } catch (e) {
    console.error('[candidates jobs GET] resume', e)
    return NextResponse.json({ jobs: [], shares: [], count: 0 }, { status: 200 })
  }
  if (!cand.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // One profile, many client shares. Each submission is a row — not a duplicate candidate.
  const shares: Record<string, unknown>[] = []
  const seenJobs = new Set<string>()

  const pushShareRows = (rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      if (r.job_id) seenJobs.add(String(r.job_id))
      shares.push({
        ...r,
        source: 'submission',
        id: r.job_id ?? r.submission_id,
        short_id: r.job_short_id ?? r.submission_short_id,
        company: r.client,
      })
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         s.id AS submission_id,
         s.short_id AS submission_short_id,
         s.stage,
         s.client_name,
         s.applying_for,
         s.submission_date,
         s.updated_at,
         s.job_post_id,
         jp.id AS job_id,
         jp.short_id AS job_short_id,
         jp.title,
         jp.location,
         jp.status AS job_status,
         COALESCE(cl.name, jp.company, s.client_name) AS client,
         jp.client_id
       FROM submissions s
       LEFT JOIN job_posts jp ON jp.id = s.job_post_id AND jp.tenant_id = s.tenant_id
       LEFT JOIN clients cl ON cl.id = jp.client_id
       WHERE s.tenant_id = $1 AND s.resume_id = $2
       ORDER BY s.updated_at DESC`,
      [ctx.tenantId, id]
    )
    pushShareRows(rows)
  } catch {
    try {
      const { rows } = await pool.query(
        `SELECT
           s.id AS submission_id,
           s.short_id AS submission_short_id,
           s.stage,
           s.client_name,
           s.applying_for,
           s.submission_date,
           s.updated_at,
           s.job_post_id,
           jp.id AS job_id,
           jp.short_id AS job_short_id,
           jp.title,
           jp.location,
           jp.status AS job_status,
           COALESCE(jp.company, s.client_name) AS client
         FROM submissions s
         LEFT JOIN job_posts jp ON jp.id = s.job_post_id AND jp.tenant_id = s.tenant_id
         WHERE s.tenant_id = $1 AND s.resume_id = $2
         ORDER BY s.updated_at DESC`,
        [ctx.tenantId, id]
      )
      pushShareRows(rows)
    } catch { /* older DBs without submissions */ }
  }

  if (cand.rows[0].job_post_id && !seenJobs.has(cand.rows[0].job_post_id)) {
    try {
      const { rows } = await pool.query(
        `SELECT jp.id, jp.short_id, jp.title, jp.company, jp.location, jp.status,
                COALESCE(cl.name, jp.company) AS client
         FROM job_posts jp
         LEFT JOIN clients cl ON cl.id = jp.client_id
         WHERE jp.id = $1 AND jp.tenant_id = $2`,
        [cand.rows[0].job_post_id, ctx.tenantId]
      )
      for (const j of rows) {
        shares.push({
          ...j,
          job_id: j.id,
          job_short_id: j.short_id,
          client: j.client,
          source: 'assigned',
          stage: null,
        })
      }
    } catch {
      try {
        const { rows } = await pool.query(
          `SELECT jp.id, jp.short_id, jp.title, jp.company, jp.location, jp.status
           FROM job_posts jp
           WHERE jp.id = $1 AND jp.tenant_id = $2`,
          [cand.rows[0].job_post_id, ctx.tenantId]
        )
        for (const j of rows) {
          shares.push({
            ...j,
            job_id: j.id,
            job_short_id: j.short_id,
            client: j.company,
            source: 'assigned',
            stage: null,
          })
        }
      } catch { /* assigned job lookup optional */ }
    }
  }

  return NextResponse.json({ jobs: shares, shares, count: shares.length })
}
