import { pool } from './db'
import { writeTimeline } from './timelineEngine'
import { logAudit } from './audit'
import { createNotification } from './notificationCenter'

export type WorkflowEntity =
  | 'job' | 'submission' | 'interview' | 'offer' | 'document' | 'joining' | 'candidate'

export async function upsertWorkflowInstance(opts: {
  tenantId: string
  entityType: WorkflowEntity
  entityId: string
  stage: string
  resumeId?: string | null
  jobPostId?: string | null
  slaDueAt?: Date | string | null
  waitingStatus?: string
  approvalStatus?: string
  requiredDocs?: unknown[]
  aiHint?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  detail?: string | null
}): Promise<string | null> {
  try {
    const existing = await pool.query<{ id: string; stage: string }>(
      `SELECT id, stage FROM workflow_instances
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 LIMIT 1`,
      [opts.tenantId, opts.entityType, opts.entityId]
    )

    let instanceId: string
    const fromStage = existing.rows[0]?.stage ?? null

    if (existing.rows[0]) {
      instanceId = existing.rows[0].id
      await pool.query(
        `UPDATE workflow_instances SET
           stage = $1,
           waiting_status = COALESCE($2, waiting_status),
           sla_due_at = COALESCE($3, sla_due_at),
           approval_status = COALESCE($4, approval_status),
           required_docs = COALESCE($5::jsonb, required_docs),
           ai_hint = COALESCE($6, ai_hint),
           resume_id = COALESCE($7, resume_id),
           job_post_id = COALESCE($8, job_post_id),
           updated_at = NOW()
         WHERE id = $9`,
        [
          opts.stage,
          opts.waitingStatus ?? null,
          opts.slaDueAt ? new Date(opts.slaDueAt).toISOString() : null,
          opts.approvalStatus ?? null,
          opts.requiredDocs ? JSON.stringify(opts.requiredDocs) : null,
          opts.aiHint ?? null,
          opts.resumeId ?? null,
          opts.jobPostId ?? null,
          instanceId,
        ]
      )
    } else {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO workflow_instances
           (tenant_id, entity_type, entity_id, resume_id, job_post_id, stage,
            waiting_status, sla_due_at, approval_status, required_docs, ai_hint)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
         RETURNING id`,
        [
          opts.tenantId,
          opts.entityType,
          opts.entityId,
          opts.resumeId ?? null,
          opts.jobPostId ?? null,
          opts.stage,
          opts.waitingStatus ?? 'active',
          opts.slaDueAt ? new Date(opts.slaDueAt).toISOString() : null,
          opts.approvalStatus ?? 'none',
          JSON.stringify(opts.requiredDocs ?? []),
          opts.aiHint ?? null,
        ]
      )
      instanceId = rows[0].id
    }

    await pool.query(
      `INSERT INTO workflow_events
         (tenant_id, instance_id, event_type, from_stage, to_stage, actor_user_id, actor_email, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        opts.tenantId,
        instanceId,
        fromStage ? 'stage_changed' : 'opened',
        fromStage,
        opts.stage,
        opts.actorUserId ?? null,
        opts.actorEmail ?? null,
        opts.detail ?? null,
      ]
    )

    if (opts.resumeId) {
      await writeTimeline({
        tenantId: opts.tenantId,
        entityType: opts.entityType === 'candidate' ? 'candidate' : opts.entityType as 'submission',
        entityId: opts.entityId,
        resumeId: opts.resumeId,
        eventType: `workflow_${opts.entityType}`,
        title: `Workflow → ${opts.stage.replace(/_/g, ' ')}`,
        detail: opts.detail ?? (fromStage ? `${fromStage} → ${opts.stage}` : opts.stage),
        actorUserId: opts.actorUserId,
        actorEmail: opts.actorEmail,
      })
    }

    return instanceId
  } catch (e) {
    console.warn('[workflow]', e instanceof Error ? e.message : e)
    return null
  }
}

/** Escalate overdue SLA instances; returns count escalated. */
export async function escalateOverdueWorkflows(opts: {
  tenantId: string
  userId: string
}): Promise<number> {
  let n = 0
  try {
    const { rows } = await pool.query<{
      id: string
      entity_type: string
      entity_id: string
      resume_id: string | null
      escalation_level: number
      stage: string
    }>(
      `SELECT id, entity_type, entity_id, resume_id, escalation_level, stage
       FROM workflow_instances
       WHERE tenant_id = $1
         AND waiting_status = 'active'
         AND sla_due_at IS NOT NULL
         AND sla_due_at < NOW()
         AND escalation_level < 3
       LIMIT 50`,
      [opts.tenantId]
    )

    for (const row of rows) {
      const level = (row.escalation_level ?? 0) + 1
      await pool.query(
        `UPDATE workflow_instances SET
           escalation_level = $1,
           waiting_status = 'escalated',
           updated_at = NOW()
         WHERE id = $2`,
        [level, row.id]
      )
      await pool.query(
        `INSERT INTO workflow_events
           (tenant_id, instance_id, event_type, from_stage, to_stage, detail)
         VALUES ($1,$2,'escalated',$3,$3,$4)`,
        [opts.tenantId, row.id, row.stage, `SLA breached — escalation level ${level}`]
      )
      await createNotification({
        tenantId: opts.tenantId,
        userId: opts.userId,
        category: 'reminder',
        title: `SLA escalation: ${row.entity_type}`,
        body: `${row.entity_id} · stage ${row.stage} · level ${level}`,
        entityType: row.entity_type,
        entityId: row.entity_id,
        resumeId: row.resume_id,
      })
      n++
    }
  } catch (e) {
    console.warn('[workflow escalate]', e instanceof Error ? e.message : e)
  }
  return n
}

export async function listWorkflowForResume(tenantId: string, resumeId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM workflow_instances
       WHERE tenant_id = $1 AND resume_id = $2
       ORDER BY updated_at DESC LIMIT 20`,
      [tenantId, resumeId]
    )
    return rows
  } catch {
    return []
  }
}
