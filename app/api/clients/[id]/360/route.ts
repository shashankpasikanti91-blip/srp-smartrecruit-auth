import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { listEntityTimeline } from '@/lib/timelineEngine'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const clientRes = await pool.query(
    `SELECT * FROM clients WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!clientRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const client = clientRes.rows[0]

  const [jobs, submissions, offers, recruiters, docs, meetings, timeline] = await Promise.all([
    pool.query(
      `SELECT id, short_id, title, status, location, priority, created_at
       FROM job_posts WHERE tenant_id = $1 AND client_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT s.id, s.short_id, s.stage, s.client_name, r.candidate_name, s.updated_at
       FROM submissions s
       JOIN resumes r ON r.id = s.resume_id
       WHERE s.tenant_id = $1 AND (s.client_name ILIKE $2 OR s.job_post_id IN (
         SELECT id FROM job_posts WHERE client_id = $3
       ))
       ORDER BY s.updated_at DESC LIMIT 40`,
      [ctx.tenantId, client.name, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT o.id, o.short_id, o.status, o.offer_salary, r.candidate_name, o.updated_at
       FROM offer_cases o
       JOIN resumes r ON r.id = o.resume_id
       JOIN job_posts j ON j.id = o.job_post_id
       WHERE o.tenant_id = $1 AND j.client_id = $2
       ORDER BY o.updated_at DESC LIMIT 30`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    // Do NOT fall back to all tenant offers — that leaks other clients' placements
    pool.query(
      `SELECT DISTINCT u.id, u.name, u.email, COUNT(s.id)::int AS submissions
       FROM submissions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.tenant_id = $1 AND s.client_name ILIKE $2
       GROUP BY u.id, u.name, u.email
       ORDER BY submissions DESC LIMIT 10`,
      [ctx.tenantId, client.name]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT * FROM client_documents WHERE tenant_id = $1 AND client_id = $2
       ORDER BY created_at DESC LIMIT 30`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT * FROM client_meetings WHERE tenant_id = $1 AND client_id = $2
       ORDER BY scheduled_at DESC NULLS LAST LIMIT 20`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    listEntityTimeline({ tenantId: ctx.tenantId, entityType: 'client', entityId: id, limit: 30 }).catch(() => []),
  ])

  const placements = offers.rows.filter((o: { status: string }) =>
    ['joined', 'joining_confirmed', 'completed', 'offer_accepted'].includes(o.status)
  )

  const activeJobs = jobs.rows.filter((j: { status: string }) =>
    !['archived', 'closed', 'filled'].includes(j.status)
  )

  return NextResponse.json({
    client,
    requirements: activeJobs.map((j: { title: string; short_id: string; status: string }) => ({
      title: j.title,
      short_id: j.short_id,
      status: j.status,
    })),
    jobs: jobs.rows,
    active_jobs: activeJobs,
    placements,
    revenue: {
      ytd: client.revenue_ytd ?? null,
      placements_count: placements.length,
    },
    recruiters: recruiters.rows,
    communications: [], // linked via job/client_id on comm logs when present
    meetings: meetings.rows,
    documents: docs.rows,
    contracts: docs.rows.filter((d: { doc_type?: string }) => d.doc_type === 'contract'),
    timeline,
    submissions: submissions.rows,
    ai_insights: [
      activeJobs.length === 0
        ? 'No active jobs for this client — consider a business development follow-up.'
        : `${activeJobs.length} active job(s) open.`,
      placements.length
        ? `${placements.length} placement(s) recorded in offer pipeline.`
        : 'No placements yet — review submission conversion.',
      recruiters.rows.length
        ? `Top recruiter activity: ${(recruiters.rows[0] as { name?: string }).name ?? '—'}`
        : 'No recruiter submission activity tagged to this client name.',
    ],
  })
}
