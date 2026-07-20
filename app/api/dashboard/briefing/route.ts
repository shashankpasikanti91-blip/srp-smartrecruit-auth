import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { computeRecruiterKpi } from '@/lib/kpiEngine'
import { listAgentSuggestions } from '@/lib/agentFramework'
import { listCollaborations } from '@/lib/agentCollaboration'

/** AI Daily Briefing — morning summary for dashboard. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const today = new Date().toISOString().slice(0, 10)

  // Cache hit
  try {
    const cached = await pool.query(
      `SELECT payload, narrative FROM ai_daily_briefings
       WHERE tenant_id = $1 AND user_id = $2 AND briefing_date = $3`,
      [ctx.tenantId, ctx.userId, today]
    )
    if (cached.rows[0] && req.nextUrl.searchParams.get('refresh') !== '1') {
      return NextResponse.json({
        date: today,
        ...cached.rows[0].payload,
        narrative: cached.rows[0].narrative,
        cached: true,
      })
    }
  } catch { /* table may not exist yet */ }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const weekEnd = new Date(Date.now() + 7 * 86400000)

  const q = async <T,>(sql: string, params: unknown[]): Promise<T[]> => {
    try {
      const { rows } = await pool.query(sql, params)
      return rows as T[]
    } catch {
      return []
    }
  }

  const [
    newCandidates,
    pendingInterviews,
    waitingFeedback,
    offersPending,
    joiningWeek,
    visas,
    missingDocs,
    kpi,
    suggestions,
    collabs,
  ] = await Promise.all([
    q<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resumes WHERE tenant_id = $1 AND created_at >= $2`,
      [ctx.tenantId, startOfDay.toISOString()]
    ),
    q<{ id: string; candidate_name: string; scheduled_at: string }>(
      `SELECT id, candidate_name, scheduled_at::text FROM interviews
       WHERE tenant_id = $1 AND status = 'scheduled' AND scheduled_at::date = CURRENT_DATE
       LIMIT 10`,
      [ctx.tenantId]
    ),
    q<{ id: string; candidate_name: string }>(
      `SELECT id, candidate_name FROM interviews
       WHERE tenant_id = $1 AND status IN ('completed','awaiting_feedback')
       LIMIT 10`,
      [ctx.tenantId]
    ),
    q<{ id: string; short_id: string; status: string }>(
      `SELECT id, short_id, status FROM offer_cases
       WHERE tenant_id = $1 AND status IN ('offer_released','offer_signed','salary_negotiation')
       LIMIT 10`,
      [ctx.tenantId]
    ),
    q<{ candidate_name: string; expected_joining: string }>(
      `SELECT r.candidate_name, o.expected_joining::text
       FROM offer_cases o JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1 AND o.expected_joining IS NOT NULL
         AND o.expected_joining::date <= $2::date
         AND o.expected_joining::date >= CURRENT_DATE
       LIMIT 10`,
      [ctx.tenantId, weekEnd.toISOString().slice(0, 10)]
    ),
    q<{ candidate_name: string; visa_expiry: string }>(
      `SELECT candidate_name,
              COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date') AS visa_expiry
       FROM resumes WHERE tenant_id = $1
         AND COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date') IS NOT NULL
         AND COALESCE(candidate_profile->>'visa_expiry', candidate_profile->>'visa_expiry_date')::date
             <= CURRENT_DATE + INTERVAL '30 days'
       LIMIT 10`,
      [ctx.tenantId]
    ),
    q<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM candidate_documents d
       JOIN resumes r ON r.id = d.resume_id
       WHERE r.tenant_id = $1
         AND COALESCE(d.verification_status,'pending_verification') IN
           ('pending_verification','rejected','replacement_requested','expired')`,
      [ctx.tenantId]
    ),
    computeRecruiterKpi({ tenantId: ctx.tenantId, userId: ctx.userId, days: 7 }),
    listAgentSuggestions({ tenantId: ctx.tenantId, status: 'pending', limit: 5 }),
    listCollaborations({ tenantId: ctx.tenantId, status: 'pending', limit: 3 }),
  ])

  const payload = {
    new_candidates: newCandidates[0]?.n ?? 0,
    pending_interviews: pendingInterviews,
    waiting_feedback: waitingFeedback,
    offers_pending: offersPending,
    joining_this_week: joiningWeek,
    expiring_visas: visas,
    missing_documents: missingDocs[0]?.n ?? 0,
    recruiter_performance: {
      submissions: kpi.submissions,
      interviews_scheduled: kpi.interviews_scheduled,
      offers_active: kpi.offers_active,
      follow_ups_overdue: kpi.follow_ups_overdue,
    },
    ai_recommendations: suggestions.slice(0, 5).map((s: { title: string; rationale?: string }) => ({
      title: s.title,
      rationale: s.rationale,
    })),
    collaborations: collabs.map((c: { id: string; consolidated_title: string }) => ({
      id: c.id,
      title: c.consolidated_title,
    })),
  }

  const narrative = [
    `Good morning — here's your SRP SmartRecruit briefing for ${today}.`,
    `• ${payload.new_candidates} new candidate(s) today`,
    `• ${pendingInterviews.length} interview(s) scheduled today`,
    `• ${waitingFeedback.length} waiting on feedback`,
    `• ${offersPending.length} offer(s) pending acceptance`,
    `• ${joiningWeek.length} joining this week`,
    `• ${visas.length} visa(s) expiring within 30 days`,
    `• ${payload.missing_documents} document(s) needing verification`,
    suggestions[0] ? `• Top AI rec: ${suggestions[0].title}` : '• No pending AI recommendations',
  ].join('\n')

  try {
    await pool.query(
      `INSERT INTO ai_daily_briefings (tenant_id, user_id, briefing_date, payload, narrative)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (tenant_id, user_id, briefing_date)
       DO UPDATE SET payload = EXCLUDED.payload, narrative = EXCLUDED.narrative`,
      [ctx.tenantId, ctx.userId, today, JSON.stringify(payload), narrative]
    )
  } catch { /* ignore */ }

  return NextResponse.json({ date: today, ...payload, narrative, cached: false })
}
