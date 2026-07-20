import { pool } from './db'
import { createNotification } from './notificationCenter'
import { addSuggestionInternal, type AgentType } from './agentFramework'

export type CollabStep = {
  agent: AgentType
  action: string
  detail?: string
}

/**
 * When an interview completes / candidate selected, chain agents into one
 * consolidated recommendation for the recruiter (never auto-executes).
 */
export async function runCollaborativeChain(opts: {
  tenantId: string
  userId: string
  triggerEvent: string
  resumeId?: string | null
  jobPostId?: string | null
  entityType?: string
  entityId?: string
  candidateName?: string
}): Promise<{ collaborationId: string | null }> {
  const name = opts.candidateName ?? 'candidate'
  const chain: CollabStep[] = []

  if (opts.triggerEvent === 'interview_completed' || opts.triggerEvent === 'candidate_selected') {
    chain.push(
      { agent: 'interview', action: 'status_updated', detail: 'Interview marked complete / selected' },
      { agent: 'offer', action: 'detect_selection', detail: 'Prepare offer draft checklist' },
      { agent: 'document', action: 'request_missing_docs', detail: 'Identify missing verification documents' },
      { agent: 'joining', action: 'prepare_onboarding', detail: 'Draft joining checklist + WhatsApp' },
    )
  } else if (opts.triggerEvent === 'offer_accepted') {
    chain.push(
      { agent: 'offer', action: 'accepted', detail: 'Offer accepted' },
      { agent: 'document', action: 'verify_pack', detail: 'Verify pre-joining documents' },
      { agent: 'joining', action: 'schedule_reminders', detail: '7d/3d/1d joining reminders' },
      { agent: 'visa', action: 'check_expiry', detail: 'Flag visa risk before start date' },
    )
  } else {
    chain.push({ agent: 'follow_up', action: 'review', detail: opts.triggerEvent })
  }

  const title = `Coordinated next steps for ${name}`
  const body = [
    `Trigger: ${opts.triggerEvent.replace(/_/g, ' ')}`,
    '',
    'Agent collaboration chain (recommend only — you approve each step):',
    ...chain.map((s, i) => `${i + 1}. [${s.agent}] ${s.action}${s.detail ? ` — ${s.detail}` : ''}`),
    '',
    'Suggested recruiter actions:',
    '• Confirm selection with client',
    '• Request missing documents via WhatsApp/email',
    '• Draft offer (if approved)',
    '• Schedule joining follow-ups',
  ].join('\n')

  let collaborationId: string | null = null
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO agent_collaborations
         (tenant_id, trigger_event, entity_type, entity_id, resume_id, job_post_id,
          chain, consolidated_title, consolidated_body, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'pending')
       RETURNING id`,
      [
        opts.tenantId,
        opts.triggerEvent,
        opts.entityType ?? null,
        opts.entityId ?? null,
        opts.resumeId ?? null,
        opts.jobPostId ?? null,
        JSON.stringify(chain),
        title,
        body,
      ]
    )
    collaborationId = rows[0]?.id ?? null
  } catch (e) {
    console.warn('[collab]', e instanceof Error ? e.message : e)
    return { collaborationId: null }
  }

  const suggestionIds: string[] = []
  for (const step of chain) {
    try {
      const id = await addSuggestionInternal({
        tenantId: opts.tenantId,
        agentType: step.agent,
        title: `${step.agent}: ${step.action} — ${name}`,
        rationale: step.detail,
        draftMessage: step.agent === 'document'
          ? `Hi ${name}, please share the remaining documents for your offer process. Thank you!`
          : step.agent === 'joining'
            ? `Hi ${name}, sharing your joining checklist and first-day details.`
            : undefined,
        draftChannel: step.agent === 'joining' || step.agent === 'document' ? 'whatsapp' : 'email',
        entityType: opts.entityType,
        entityId: opts.entityId,
        resumeId: opts.resumeId,
        jobPostId: opts.jobPostId,
        collaborationId,
      })
      if (id) suggestionIds.push(id)
    } catch { /* ignore */ }
  }

  if (collaborationId && suggestionIds.length) {
    try {
      await pool.query(
        `UPDATE agent_collaborations SET suggestion_ids = $1::uuid[] WHERE id = $2`,
        [suggestionIds, collaborationId]
      )
    } catch { /* ignore */ }
  }

  await createNotification({
    tenantId: opts.tenantId,
    userId: opts.userId,
    category: 'reminder',
    title: title,
    body: `${chain.length} coordinated agent steps ready for your approval`,
    resumeId: opts.resumeId ?? undefined,
    entityType: 'collaboration',
    entityId: collaborationId ?? undefined,
  })

  return { collaborationId }
}

export async function listCollaborations(opts: {
  tenantId: string
  status?: string
  limit?: number
}) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM agent_collaborations
       WHERE tenant_id = $1 AND status = $2
       ORDER BY created_at DESC LIMIT $3`,
      [opts.tenantId, opts.status ?? 'pending', opts.limit ?? 20]
    )
    return rows
  } catch {
    return []
  }
}

export async function resolveCollaboration(opts: {
  tenantId: string
  userId: string
  id: string
  action: 'accepted' | 'dismissed'
}) {
  try {
    const { rows } = await pool.query(
      `UPDATE agent_collaborations SET
         status = $1, resolved_at = NOW(), resolved_by = $2
       WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
       RETURNING *`,
      [opts.action, opts.userId, opts.id, opts.tenantId]
    )
    return rows[0] ?? null
  } catch {
    return null
  }
}
