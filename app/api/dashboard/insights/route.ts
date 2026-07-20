import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'

/** Dashboard Power BI–style aggregates for Workspace */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const days = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const empty = {
    submission_trend: [] as { d: string; n: number }[],
    interview_trend: [] as { d: string; n: number }[],
    offer_trend: [] as { d: string; n: number }[],
    leaderboard: [] as { name: string; email: string; submissions: number; interviews: number; offers: number }[],
    funnel: {} as Record<string, number>,
    aging: [] as { bucket: string; n: number }[],
    pending_docs: 0,
    time_to_hire_avg_days: null as number | null,
    offer_acceptance_rate: null as number | null,
    recent_activities: [] as { title: string; at: string; actor?: string }[],
    queues: {
      jobs_attention: [] as unknown[],
      candidates_waiting: [] as unknown[],
      interviews_pending_feedback: [] as unknown[],
      offers_pending: [] as unknown[],
      missing_documents: [] as unknown[],
      joining_tomorrow: [] as unknown[],
      visa_expiry: [] as unknown[],
      source_performance: [] as unknown[],
      ai_recommendations: [] as unknown[],
    },
  }

  try {
    const [subTrend, intTrend, offerTrend, leaderboard, funnel, aging, offersStats, recent] = await Promise.all([
      pool.query(
        `SELECT DATE(created_at)::text AS d, COUNT(*)::int AS n
         FROM submissions WHERE tenant_id = $1 AND created_at >= $2
         GROUP BY 1 ORDER BY 1`,
        [ctx.tenantId, since]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT DATE(created_at)::text AS d, COUNT(*)::int AS n
         FROM interviews WHERE tenant_id = $1 AND created_at >= $2
         GROUP BY 1 ORDER BY 1`,
        [ctx.tenantId, since]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT DATE(created_at)::text AS d, COUNT(*)::int AS n
         FROM offer_cases WHERE tenant_id = $1 AND created_at >= $2
         GROUP BY 1 ORDER BY 1`,
        [ctx.tenantId, since]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT COALESCE(u.name, u.email) AS name, u.email,
                COUNT(DISTINCT s.id)::int AS submissions,
                COUNT(DISTINCT i.id)::int AS interviews,
                COUNT(DISTINCT o.id)::int AS offers
         FROM auth_users u
         LEFT JOIN submissions s ON s.user_id = u.id AND s.tenant_id = $1 AND s.created_at >= $2
         LEFT JOIN interviews i ON i.interviewer_id = u.id AND i.tenant_id = $1 AND i.created_at >= $2
         LEFT JOIN offer_cases o ON o.user_id = u.id AND o.tenant_id = $1 AND o.created_at >= $2
         WHERE u.id IN (
           SELECT user_id FROM tenant_members WHERE tenant_id = $1
         )
         GROUP BY u.id, u.name, u.email
         HAVING COUNT(DISTINCT s.id) + COUNT(DISTINCT i.id) + COUNT(DISTINCT o.id) > 0
         ORDER BY submissions DESC, interviews DESC
         LIMIT 10`,
        [ctx.tenantId, since]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT pipeline_stage AS stage, COUNT(*)::int AS n
         FROM resumes WHERE tenant_id = $1 AND pipeline_stage IS NOT NULL
         GROUP BY 1`,
        [ctx.tenantId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT bucket, COUNT(*)::int AS n FROM (
           SELECT CASE
             WHEN NOW() - created_at < INTERVAL '7 days' THEN '0-7d'
             WHEN NOW() - created_at < INTERVAL '14 days' THEN '8-14d'
             WHEN NOW() - created_at < INTERVAL '30 days' THEN '15-30d'
             WHEN NOW() - created_at < INTERVAL '60 days' THEN '31-60d'
             ELSE '60d+'
           END AS bucket
           FROM resumes
           WHERE tenant_id = $1
             AND COALESCE(pipeline_stage, '') NOT IN ('hired', 'rejected', 'withdrawn')
         ) t GROUP BY 1 ORDER BY 1`,
        [ctx.tenantId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('offer_accepted','joined','joining_confirmed','onboarding','completed'))::int AS accepted,
           COUNT(*) FILTER (WHERE status IN ('offer_released','offer_accepted','offer_rejected','joined','joining_confirmed'))::int AS released
         FROM offer_cases WHERE tenant_id = $1 AND created_at >= $2`,
        [ctx.tenantId, since]
      ).catch(() => ({ rows: [{ accepted: 0, released: 0 }] })),
      pool.query(
        `SELECT title, created_at AS at, actor_email AS actor
         FROM entity_timeline WHERE tenant_id = $1
         ORDER BY created_at DESC LIMIT 12`,
        [ctx.tenantId]
      ).catch(async () => {
        const r = await pool.query(
          `SELECT action AS title, created_at AS at, user_email AS actor
           FROM audit_logs WHERE tenant_id = $1
           ORDER BY created_at DESC LIMIT 12`,
          [ctx.tenantId]
        ).catch(() => ({ rows: [] }))
        return r
      }),
    ])

    const funnelMap: Record<string, number> = {}
    for (const r of funnel.rows) funnelMap[r.stage] = r.n

    const accepted = offersStats.rows[0]?.accepted ?? 0
    const released = offersStats.rows[0]?.released ?? 0

    // Time to hire proxy: avg days from resume created to offer joined
    let tth: number | null = null
    try {
      const { rows } = await pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - r.created_at)) / 86400)::float AS avg_days
         FROM offer_cases o
         JOIN resumes r ON r.id = o.resume_id
         WHERE o.tenant_id = $1 AND o.status IN ('joined','completed') AND o.updated_at >= $2`,
        [ctx.tenantId, since]
      )
      tth = rows[0]?.avg_days != null ? Math.round(rows[0].avg_days * 10) / 10 : null
    } catch { /* ignore */ }

    let pendingDocs = 0
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM offer_cases
         WHERE tenant_id = $1 AND status IN ('document_collection','document_verification','selected')`,
        [ctx.tenantId]
      )
      pendingDocs = rows[0]?.n ?? 0
    } catch { /* ignore */ }

    // Action queues (Phase 2.5)
    const queue = async <T,>(sql: string, params: unknown[] = [ctx.tenantId]): Promise<T[]> => {
      try {
        const { rows } = await pool.query(sql, params)
        return rows as T[]
      } catch {
        return []
      }
    }

    const [
      jobsAttention,
      candidatesWaiting,
      interviewsPendingFeedback,
      offersPending,
      missingDocuments,
      joiningTomorrow,
      visaExpiry,
      sourcePerformance,
      agentRecs,
    ] = await Promise.all([
      queue<{ id: string; short_id: string; title: string; company: string | null; priority: string | null; reason: string }>(
        `SELECT j.id, j.short_id, j.title, j.company, j.priority,
                CASE
                  WHEN j.priority ILIKE 'high%' THEN 'HIGH priority'
                  WHEN NOT EXISTS (SELECT 1 FROM submissions s WHERE s.job_post_id = j.id) THEN 'No submissions'
                  WHEN EXISTS (
                    SELECT 1 FROM workflow_instances w
                    WHERE w.job_post_id = j.id AND w.waiting_status = 'escalated'
                  ) THEN 'SLA breach'
                  ELSE 'Needs attention'
                END AS reason
         FROM job_posts j
         WHERE j.tenant_id = $1 AND j.status NOT IN ('archived','closed','filled')
           AND (
             j.priority ILIKE 'high%'
             OR NOT EXISTS (SELECT 1 FROM submissions s WHERE s.job_post_id = j.id)
             OR EXISTS (
               SELECT 1 FROM workflow_instances w
               WHERE w.job_post_id = j.id AND w.waiting_status = 'escalated'
             )
           )
         ORDER BY CASE WHEN j.priority ILIKE 'high%' THEN 0 ELSE 1 END, j.updated_at DESC
         LIMIT 10`
      ),
      queue<{ bucket: string; n: number }>(
        `SELECT bucket, COUNT(*)::int AS n FROM (
           SELECT CASE
             WHEN NOW() - created_at < INTERVAL '7 days' THEN '0-7d'
             WHEN NOW() - created_at < INTERVAL '14 days' THEN '8-14d'
             WHEN NOW() - created_at < INTERVAL '30 days' THEN '15-30d'
             ELSE '30d+'
           END AS bucket
           FROM resumes
           WHERE tenant_id = $1
             AND COALESCE(pipeline_stage, '') NOT IN ('hired', 'rejected', 'withdrawn')
         ) t GROUP BY 1 ORDER BY 1`
      ),
      queue<{ id: string; short_id: string; candidate_name: string; scheduled_at: string }>(
        `SELECT id, short_id, candidate_name, scheduled_at::text
         FROM interviews
         WHERE tenant_id = $1
           AND status IN ('completed','awaiting_feedback')
           AND (feedback IS NULL OR feedback::text IN ('{}','null',''))
         ORDER BY scheduled_at DESC LIMIT 10`
      ),
      queue<{ id: string; short_id: string; status: string; candidate_name: string }>(
        `SELECT o.id, o.short_id, o.status, r.candidate_name
         FROM offer_cases o
         JOIN resumes r ON r.id = o.resume_id
         WHERE o.tenant_id = $1
           AND o.status IN ('offer_released','offer_signed','salary_negotiation')
         ORDER BY o.updated_at DESC LIMIT 10`
      ),
      queue<{ resume_id: string; candidate_name: string; n: number }>(
        `SELECT r.id AS resume_id, r.candidate_name, COUNT(d.id)::int AS n
         FROM resumes r
         JOIN candidate_documents d ON d.resume_id = r.id
         WHERE r.tenant_id = $1
           AND COALESCE(d.verification_status,'pending_verification') IN
             ('pending_verification','rejected','replacement_requested','expired')
         GROUP BY r.id, r.candidate_name
         ORDER BY n DESC LIMIT 10`
      ),
      queue<{ id: string; short_id: string; candidate_name: string; expected_joining: string }>(
        `SELECT o.id, o.short_id, r.candidate_name, o.expected_joining::text
         FROM offer_cases o
         JOIN resumes r ON r.id = o.resume_id
         WHERE o.tenant_id = $1
           AND o.expected_joining::date = CURRENT_DATE + INTERVAL '1 day'
         LIMIT 10`
      ),
      queue<{ id: string; candidate_name: string; visa_expiry: string }>(
        `SELECT id, candidate_name,
                COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date') AS visa_expiry
         FROM resumes
         WHERE tenant_id = $1
           AND COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date') IS NOT NULL
           AND COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date')::date
               <= CURRENT_DATE + INTERVAL '30 days'
         ORDER BY 3 ASC LIMIT 10`
      ),
      queue<{ source: string; n: number }>(
        `SELECT COALESCE(NULLIF(candidate_profile->>'source',''),'(unknown)') AS source, COUNT(*)::int AS n
         FROM resumes WHERE tenant_id = $1 AND created_at >= $2
         GROUP BY 1 ORDER BY n DESC LIMIT 10`,
        [ctx.tenantId, since]
      ),
      queue<{ id: string; title: string; agent_type: string; rationale: string | null }>(
        `SELECT id, title, agent_type, rationale
         FROM agent_suggestions
         WHERE tenant_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 3`
      ),
    ])

    return NextResponse.json({
      days,
      submission_trend: subTrend.rows,
      interview_trend: intTrend.rows,
      offer_trend: offerTrend.rows,
      leaderboard: leaderboard.rows,
      funnel: funnelMap,
      aging: aging.rows,
      pending_docs: pendingDocs,
      time_to_hire_avg_days: tth,
      offer_acceptance_rate: released > 0 ? Math.round((accepted / released) * 100) : null,
      recent_activities: recent.rows.map((r: { title: string; at: Date; actor?: string }) => ({
        title: String(r.title ?? '').replace(/_/g, ' '),
        at: new Date(r.at).toISOString(),
        actor: r.actor,
      })),
      queues: {
        jobs_attention: jobsAttention,
        candidates_waiting: candidatesWaiting,
        interviews_pending_feedback: interviewsPendingFeedback,
        offers_pending: offersPending,
        missing_documents: missingDocuments,
        joining_tomorrow: joiningTomorrow,
        visa_expiry: visaExpiry,
        source_performance: sourcePerformance,
        ai_recommendations: agentRecs,
      },
    })
  } catch (e) {
    console.error('[dashboard/insights]', e)
    return NextResponse.json(empty)
  }
}
