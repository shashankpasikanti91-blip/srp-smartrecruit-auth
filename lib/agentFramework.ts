import { pool } from './db'
import { ensureAutoFollowUp } from './autoFollowUps'
import { createNotification } from './notificationCenter'

/**
 * Recommend-only agent framework (V2).
 * Agents create pending suggestions for human approval — they never auto-send email/WhatsApp
 * or mutate pipeline without an explicit approve API. LangGraph is NOT REQUIRED.
 */

export type AgentType =
  | 'submission' | 'interview' | 'offer' | 'document'
  | 'joining' | 'visa' | 'follow_up'

type SuggestionInput = {
  tenantId: string
  agentType: AgentType
  title: string
  rationale?: string
  draftMessage?: string
  draftChannel?: string
  entityType?: string
  entityId?: string
  resumeId?: string | null
  jobPostId?: string | null
  draftReminder?: Record<string, unknown>
  runId?: string | null
  collaborationId?: string | null
}

async function addSuggestion(s: SuggestionInput): Promise<string | null> {
  try {
    const dup = await pool.query(
      `SELECT id FROM agent_suggestions
       WHERE tenant_id = $1 AND agent_type = $2 AND status = 'pending'
         AND title = $3
         AND ($4::uuid IS NULL OR resume_id = $4)
       LIMIT 1`,
      [s.tenantId, s.agentType, s.title, s.resumeId ?? null]
    )
    if (dup.rows[0]) return dup.rows[0].id as string

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO agent_suggestions
         (tenant_id, agent_type, entity_type, entity_id, resume_id, job_post_id,
          title, rationale, draft_message, draft_channel, draft_reminder, run_id, collaboration_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
       RETURNING id`,
      [
        s.tenantId,
        s.agentType,
        s.entityType ?? null,
        s.entityId ?? null,
        s.resumeId ?? null,
        s.jobPostId ?? null,
        s.title,
        s.rationale ?? null,
        s.draftMessage ?? null,
        s.draftChannel ?? 'email',
        JSON.stringify(s.draftReminder ?? {}),
        s.runId ?? null,
        s.collaborationId ?? null,
      ]
    )
    return rows[0]?.id ?? null
  } catch (e) {
    // Fallback without collaboration_id column
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO agent_suggestions
           (tenant_id, agent_type, entity_type, entity_id, resume_id, job_post_id,
            title, rationale, draft_message, draft_channel, draft_reminder, run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
         RETURNING id`,
        [
          s.tenantId, s.agentType, s.entityType ?? null, s.entityId ?? null,
          s.resumeId ?? null, s.jobPostId ?? null, s.title, s.rationale ?? null,
          s.draftMessage ?? null, s.draftChannel ?? 'email',
          JSON.stringify(s.draftReminder ?? {}), s.runId ?? null,
        ]
      )
      return rows[0]?.id ?? null
    } catch (e2) {
      console.warn('[agent suggest]', e2 instanceof Error ? e2.message : e2)
      return null
    }
  }
}

/** Exported for agent collaboration chains. */
export async function addSuggestionInternal(s: SuggestionInput): Promise<string | null> {
  return addSuggestion(s)
}

/** Run all recommend-only agents for a tenant. Never auto-sends. */
export async function runAgentSweep(opts: {
  tenantId: string
  userId: string
}): Promise<{ runId: string | null; created: number }> {
  let runId: string | null = null
  let created = 0
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO agent_runs (tenant_id, agent_type, status, summary)
       VALUES ($1,'all','running','Phase 2.5 agent sweep') RETURNING id`,
      [opts.tenantId]
    )
    runId = rows[0]?.id ?? null
  } catch {
    /* table may not exist */
  }

  const before = await countPending(opts.tenantId)

  // Submission stuck
  try {
    const { rows } = await pool.query(
      `SELECT id, short_id, stage, resume_id, client_name, updated_at
       FROM submissions
       WHERE tenant_id = $1
         AND stage IN ('submitted','client_review','waiting_feedback')
         AND updated_at < NOW() - INTERVAL '3 days'
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'submission',
        runId,
        entityType: 'submission',
        entityId: r.id,
        resumeId: r.resume_id,
        title: `Chase client on ${r.short_id}`,
        rationale: `Submission stuck in ${r.stage} since ${new Date(r.updated_at).toLocaleDateString()}`,
        draftMessage: `Hi,\n\nFollowing up on candidate submission ${r.short_id}${r.client_name ? ` for ${r.client_name}` : ''}. Could you share feedback or next steps?\n\nThank you`,
        draftChannel: 'email',
      })
    }
  } catch { /* ignore */ }

  // Interview pending feedback
  try {
    const { rows } = await pool.query(
      `SELECT id, short_id, resume_id, candidate_name, scheduled_at, status
       FROM interviews
       WHERE tenant_id = $1
         AND status IN ('completed','awaiting_feedback')
         AND scheduled_at < NOW() - INTERVAL '4 hours'
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'interview',
        runId,
        entityType: 'interview',
        entityId: r.id,
        resumeId: r.resume_id,
        title: `Collect feedback — ${r.candidate_name || r.short_id}`,
        rationale: `Interview ${r.short_id} completed; feedback still pending`,
        draftMessage: `Hi team,\n\nPlease share interview feedback for ${r.candidate_name || 'the candidate'} (${r.short_id}).\n\nThanks`,
        draftChannel: 'email',
        draftReminder: { title: `Feedback due — ${r.short_id}`, due_hours: 24 },
      })
    }
  } catch { /* ignore */ }

  // Offer pending acceptance
  try {
    const { rows } = await pool.query(
      `SELECT id, short_id, resume_id, status, offer_expiry
       FROM offer_cases
       WHERE tenant_id = $1
         AND status IN ('offer_released','offer_draft')
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'offer',
        runId,
        entityType: 'offer',
        entityId: r.id,
        resumeId: r.resume_id,
        title: `Follow up on offer ${r.short_id || r.id.slice(0, 8)}`,
        rationale: `Offer status: ${r.status}${r.offer_expiry ? ` · expires ${r.offer_expiry}` : ''}`,
        draftMessage: `Hi,\n\nChecking in on the offer we shared. Happy to clarify any points — please let us know your decision.\n\nBest regards`,
        draftChannel: 'whatsapp',
      })
    }
  } catch { /* ignore */ }

  // Documents missing / rejected
  try {
    const { rows } = await pool.query(
      `SELECT o.resume_id, r.candidate_name, o.id AS offer_id
       FROM offer_cases o
       JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1
         AND o.status IN ('document_collection','document_verification','selected')
       LIMIT 15`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'document',
        runId,
        entityType: 'offer',
        entityId: r.offer_id,
        resumeId: r.resume_id,
        title: `Request missing documents — ${r.candidate_name || 'Candidate'}`,
        rationale: 'Candidate is in document collection / verification',
        draftMessage: `Hi ${r.candidate_name || ''},\n\nPlease upload the pending onboarding documents at your earliest convenience.\n\nThank you`,
        draftChannel: 'whatsapp',
      })
    }
  } catch { /* ignore */ }

  // Joining tomorrow
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.resume_id, o.expected_joining, r.candidate_name
       FROM offer_cases o
       JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1
         AND o.expected_joining = CURRENT_DATE + 1
         AND o.status IN ('joining_confirmed','offer_accepted','joining_followup')
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'joining',
        runId,
        entityType: 'offer',
        entityId: r.id,
        resumeId: r.resume_id,
        title: `Joining tomorrow — ${r.candidate_name || 'Candidate'}`,
        rationale: `Expected joining ${r.expected_joining}`,
        draftMessage: `Hi ${r.candidate_name || ''},\n\nLooking forward to welcoming you tomorrow. Please confirm reporting time and location.\n\nSee you soon!`,
        draftChannel: 'whatsapp',
      })
    }
  } catch { /* ignore */ }

  // Visa expiry
  try {
    const { rows } = await pool.query(
      `SELECT id, candidate_name, candidate_profile->>'visa_expiry' AS visa_expiry
       FROM resumes
       WHERE tenant_id = $1
         AND candidate_profile->>'visa_expiry' IS NOT NULL
         AND (candidate_profile->>'visa_expiry')::date <= CURRENT_DATE + 30
         AND (candidate_profile->>'visa_expiry')::date >= CURRENT_DATE - 1
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'visa',
        runId,
        entityType: 'candidate',
        entityId: r.id,
        resumeId: r.id,
        title: `Visa expiring — ${r.candidate_name || 'Candidate'}`,
        rationale: `Visa expiry ${r.visa_expiry}`,
        draftMessage: `Hi,\n\nYour work authorization appears to expire on ${r.visa_expiry}. Please share renewed documents when ready.\n\nThank you`,
        draftChannel: 'email',
      })
    }
  } catch { /* ignore */ }

  // Overdue follow-ups
  try {
    const { rows } = await pool.query(
      `SELECT id, title, resume_id, due_at
       FROM follow_ups
       WHERE tenant_id = $1 AND status = 'pending' AND due_at < NOW()
       LIMIT 20`,
      [opts.tenantId]
    )
    for (const r of rows) {
      await addSuggestion({
        tenantId: opts.tenantId,
        agentType: 'follow_up',
        runId,
        entityType: 'follow_up',
        entityId: r.id,
        resumeId: r.resume_id,
        title: `Overdue: ${r.title}`,
        rationale: `Due ${new Date(r.due_at).toLocaleString()}`,
        draftReminder: { title: r.title, due_hours: 4 },
      })
    }
  } catch { /* ignore */ }

  const after = await countPending(opts.tenantId)
  created = Math.max(0, after - before)

  if (runId) {
    try {
      await pool.query(
        `UPDATE agent_runs SET status = 'completed', summary = $1 WHERE id = $2`,
        [`Created ~${created} suggestions`, runId]
      )
    } catch { /* ignore */ }
  }

  await createNotification({
    tenantId: opts.tenantId,
    userId: opts.userId,
    category: 'reminder',
    title: 'Agent sweep complete',
    body: `${created} new recommendations ready for review`,
  })

  return { runId, created }
}

async function countPending(tenantId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM agent_suggestions WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId]
    )
    return rows[0]?.n ?? 0
  } catch {
    return 0
  }
}

export async function listAgentSuggestions(opts: {
  tenantId: string
  status?: string
  limit?: number
}) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM agent_suggestions
       WHERE tenant_id = $1 AND status = $2
       ORDER BY created_at DESC LIMIT $3`,
      [opts.tenantId, opts.status ?? 'pending', opts.limit ?? 50]
    )
    return rows
  } catch {
    return []
  }
}

export async function resolveSuggestion(opts: {
  tenantId: string
  userId: string
  id: string
  action: 'accepted' | 'dismissed'
}): Promise<{ ok: boolean; suggestion?: Record<string, unknown> }> {
  try {
    const { rows } = await pool.query(
      `UPDATE agent_suggestions SET
         status = $1, resolved_at = NOW(), resolved_by = $2
       WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
       RETURNING *`,
      [opts.action, opts.userId, opts.id, opts.tenantId]
    )
    const s = rows[0]
    if (!s) return { ok: false }

    if (opts.action === 'accepted' && s.draft_reminder && s.resume_id) {
      const rem = typeof s.draft_reminder === 'string'
        ? JSON.parse(s.draft_reminder)
        : s.draft_reminder
      const hours = Number(rem?.due_hours ?? 24)
      await ensureAutoFollowUp({
        tenantId: opts.tenantId,
        userId: opts.userId,
        resumeId: s.resume_id,
        title: rem?.title || s.title,
        dueAt: new Date(Date.now() + hours * 3600_000),
        source: `agent_${s.agent_type}`,
        notes: s.rationale ?? 'Accepted from agent suggestion',
      })
    }
    return { ok: true, suggestion: s }
  } catch {
    return { ok: false }
  }
}
