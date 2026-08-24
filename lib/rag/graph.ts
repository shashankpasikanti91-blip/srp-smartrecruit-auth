/**
 * Light talent graph — skill / job edges for match boost.
 */
import { pool } from '@/lib/db'

export type EdgeType = 'has_skill' | 'screened_for' | 'applied_to'

function normalizeSkillId(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
}

export async function upsertTalentEdge(opts: {
  tenantId: string
  fromType: string
  fromId: string
  edgeType: EdgeType
  toType: string
  toId: string
  weight?: number
}): Promise<void> {
  await pool.query(
    `INSERT INTO talent_edges
       (tenant_id, from_type, from_id, edge_type, to_type, to_id, weight, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (tenant_id, from_type, from_id, edge_type, to_type, to_id)
     DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW()`,
    [
      opts.tenantId,
      opts.fromType,
      opts.fromId,
      opts.edgeType,
      opts.toType,
      String(opts.toId).slice(0, 120),
      opts.weight ?? 1,
    ],
  )
}

/** Upsert resume → has_skill → skill nodes from ai_skills / free text. */
export async function upsertResumeSkillEdges(
  tenantId: string,
  resumeId: string,
  skills: string[],
): Promise<number> {
  const unique = [...new Set(skills.map(normalizeSkillId).filter(s => s.length >= 2))].slice(0, 40)
  let n = 0
  for (const skill of unique) {
    await upsertTalentEdge({
      tenantId,
      fromType: 'resume',
      fromId: resumeId,
      edgeType: 'has_skill',
      toType: 'skill',
      toId: skill,
      weight: 1,
    })
    n++
  }
  return n
}

export async function upsertResumeJobEdge(opts: {
  tenantId: string
  resumeId: string
  jobId: string
  edgeType: 'screened_for' | 'applied_to'
}): Promise<void> {
  await upsertTalentEdge({
    tenantId: opts.tenantId,
    fromType: 'resume',
    fromId: opts.resumeId,
    edgeType: opts.edgeType,
    toType: 'job',
    toId: opts.jobId,
    weight: 1,
  })
}

/**
 * Graph boost 0–100: shared skills between job required list and resume skill edges.
 */
export async function graphSkillBoost(
  tenantId: string,
  resumeId: string,
  requiredSkills: string[],
): Promise<number> {
  const map = await graphSkillBoostBatch(tenantId, [resumeId], requiredSkills)
  return map.get(resumeId) ?? 0
}

/** Batch graph boost for many resumes (one query). */
export async function graphSkillBoostBatch(
  tenantId: string,
  resumeIds: string[],
  requiredSkills: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!resumeIds.length || !requiredSkills.length) return out
  const req = [...new Set(requiredSkills.map(normalizeSkillId).filter(Boolean))]
  if (!req.length) return out

  try {
    const { rows } = await pool.query<{ from_id: string; to_id: string }>(
      `SELECT from_id, to_id FROM talent_edges
       WHERE tenant_id = $1 AND from_type = 'resume' AND from_id = ANY($2::text[])
         AND edge_type = 'has_skill' AND to_type = 'skill'`,
      [tenantId, resumeIds],
    )
    const byResume = new Map<string, Set<string>>()
    for (const r of rows) {
      const id = String(r.from_id)
      if (!byResume.has(id)) byResume.set(id, new Set())
      byResume.get(id)!.add(r.to_id)
    }
    for (const id of resumeIds) {
      const have = byResume.get(id)
      if (!have?.size) {
        out.set(id, 0)
        continue
      }
      let hit = 0
      for (const s of req) {
        if (have.has(s)) hit++
      }
      out.set(id, Math.round((hit / req.length) * 100))
    }
  } catch {
    /* table missing */
  }
  return out
}
