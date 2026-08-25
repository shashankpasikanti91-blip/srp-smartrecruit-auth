import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { fetchCandidateById } from '@/lib/candidateFetch'
import { buildCandidateTimeline } from '@/lib/candidateTimeline'
import { getCandidateDossierStatus } from '@/lib/dossierChecks'
import { submissionStageToLifecycle } from '@/lib/lifecycle'
import {
  ensureOwnership,
  getActiveOwnership,
  getOwnershipHistory,
  isOwnershipExpired,
} from '@/lib/ownership'

const CLOSED_SUB_STAGES = new Set([
  'rejected', 'rejected_by_candidate', 'submission_withdrawn',
  'position_closed', 'duplicate', 'joined', 'hold', 'withdrawn', 'no_show',
])
const CLOSED_IV_STATUSES = new Set(['cancelled', 'rejected', 'no_show', 'interviewer_no_show'])
const CLOSED_OFFER_STATUSES = new Set(['cancelled', 'offer_rejected', 'dropped'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
  }

  const candidate = await fetchCandidateById(ctx.tenantId, id)
  if (!candidate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ensure ownership row exists when candidate has a user_id
  if (candidate.user_id) {
    await ensureOwnership({
      tenantId: ctx.tenantId,
      entityType: 'candidate',
      entityId: id,
      ownerUserId: candidate.user_id,
      actorUserId: ctx.userId,
    }).catch(() => null)
  }

  const [
    submissions,
    interviews,
    offers,
    followUps,
    docs,
    notesCount,
    timeline,
    ownership,
    ownershipHistory,
  ] = await Promise.all([
    pool.query(
      `SELECT s.id, s.short_id, s.stage, s.client_name, s.applying_for, s.updated_at, s.created_at,
              s.job_post_id, jp.title AS job_title,
              COALESCE(cl.name, jp.company, s.client_name) AS client
       FROM submissions s
       LEFT JOIN job_posts jp ON jp.id = s.job_post_id
       LEFT JOIN clients cl ON cl.id = jp.client_id
       WHERE s.tenant_id = $1 AND s.resume_id = $2
       ORDER BY s.updated_at DESC LIMIT 40`,
      [ctx.tenantId, id],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, short_id, status, scheduled_at, format, round_name
       FROM interviews WHERE tenant_id = $1 AND resume_id = $2
       ORDER BY scheduled_at DESC LIMIT 30`,
      [ctx.tenantId, id],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, short_id, status, offer_salary, expected_joining, updated_at
       FROM offer_cases WHERE tenant_id = $1 AND resume_id = $2
       ORDER BY updated_at DESC LIMIT 20`,
      [ctx.tenantId, id],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, title, status, due_at FROM follow_ups
       WHERE tenant_id = $1 AND resume_id = $2
       ORDER BY due_at DESC LIMIT 20`,
      [ctx.tenantId, id],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM candidate_documents WHERE resume_id = $1`,
      [id],
    ).catch(() => ({ rows: [{ n: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM entity_notes
       WHERE tenant_id = $1 AND entity_type = 'candidate' AND entity_id = $2 AND is_deleted = FALSE`,
      [ctx.tenantId, id],
    ).catch(() => ({ rows: [{ n: 0 }] })),
    buildCandidateTimeline({
      tenantId: ctx.tenantId,
      resumeId: id,
      shortId: candidate.short_id,
      candidateEmail: candidate.candidate_email,
      limit: 40,
    }).catch(() => ({ events: [], next_cursor: null })),
    getActiveOwnership(ctx.tenantId, 'candidate', id),
    getOwnershipHistory(ctx.tenantId, 'candidate', id, 20),
  ])

  const dossier = getCandidateDossierStatus(candidate)
  const profile = candidate.candidate_profile ?? {}

  const latestOpenSub = submissions.rows.find(
    r => !CLOSED_SUB_STAGES.has(String(r.stage ?? '').toLowerCase()),
  )
  const displaySub = latestOpenSub ?? submissions.rows[0]
  const latestOpenIv = interviews.rows.find(
    r => !CLOSED_IV_STATUSES.has(String(r.status ?? '').toLowerCase()),
  )
  const latestOpenOff = offers.rows.find(
    r => !CLOSED_OFFER_STATUSES.has(String(r.status ?? '').toLowerCase()),
  )
  const derivedStage =
    latestOpenOff ? 'offer'
    : latestOpenIv ? 'interview'
    : latestOpenSub
      ? (submissionStageToLifecycle(String(latestOpenSub.stage)) ?? 'submitted')
      : (submissionStageToLifecycle(displaySub?.stage) ?? candidate.pipeline_stage)

  const summary = {
    profile_completion: dossier.dossierPercent,
    ai_match_score: candidate.ai_score,
    resume_score: candidate.ai_score,
    communication_status: candidate.last_contacted_at ? 'Contacted' : 'No contact',
    submission_status: displaySub
      ? `${displaySub.stage}${displaySub.job_title || displaySub.applying_for ? ` · ${displaySub.job_title || displaySub.applying_for}` : ''}${displaySub.client ? ` · ${displaySub.client}` : ''}${submissions.rows.length > 1 ? ` (+${submissions.rows.length - 1})` : ''}`
      : 'None',
    submission_count: submissions.rows.length,
    interview_status: (latestOpenIv ?? interviews.rows[0])?.status ?? 'None',
    offer_status: (latestOpenOff ?? offers.rows[0])?.status ?? 'None',
    documents_count: docs.rows[0]?.n ?? 0,
    notes_count: notesCount.rows[0]?.n ?? 0,
    activity_count: timeline.events?.length ?? 0,
  }

  return NextResponse.json({
    candidate,
    summary,
    dossier: {
      percent: dossier.dossierPercent,
      required_missing: dossier.requiredMissing,
      recommended_missing: dossier.recommendedMissing,
    },
    header: {
      name: candidate.candidate_name,
      ai_score: candidate.ai_score,
      match_category: candidate.match_category,
      status: candidate.status,
      stage: derivedStage,
      lifecycle: profile.lifecycle_status ?? null,
      availability: profile.availability ?? profile.work_authorization ?? null,
      notice_period: profile.notice_period ?? null,
      current_employer: profile.current_company ?? null,
      current_role: profile.current_title ?? null,
      location: profile.current_location ?? null,
      nationality: profile.nationality ?? null,
      owner: candidate.owner,
      last_updated: candidate.updated_at ?? candidate.created_at,
      email: candidate.candidate_email,
      phone: candidate.candidate_phone,
    },
    ownership: ownership
      ? { ...ownership, expired: isOwnershipExpired(ownership) }
      : null,
    ownership_history: ownershipHistory,
    submissions: submissions.rows,
    interviews: interviews.rows,
    offers: offers.rows,
    follow_ups: followUps.rows,
    timeline: timeline.events,
  })
}
