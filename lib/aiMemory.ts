import { pool } from './db'
import { isValidUUID } from './validate'

export type WorkingSet = {
  candidates: { id: string; name: string; short_id?: string; rank?: number }[]
  jobs: { id: string; title: string; short_id?: string }[]
  last_search?: string | null
  compared_ids?: string[]
  last_intent?: string | null
}

export type MemoryContext = {
  notes?: string
  pinned_prompts?: string[]
  working_set: WorkingSet
}

const emptySet = (): WorkingSet => ({
  candidates: [],
  jobs: [],
  last_search: null,
  compared_ids: [],
  last_intent: null,
})

export async function loadWorkingMemory(opts: {
  tenantId: string
  userId: string
  memoryKey?: string
}): Promise<MemoryContext> {
  try {
    const { rows } = await pool.query(
      `SELECT context, candidate_ids, job_ids, last_search, notes
       FROM ai_working_memory
       WHERE tenant_id = $1 AND user_id = $2 AND memory_key = $3`,
      [opts.tenantId, opts.userId, opts.memoryKey ?? 'default']
    )
    if (!rows[0]) return { working_set: emptySet() }

    const candIds: string[] = rows[0].candidate_ids ?? []
    const jobIds: string[] = rows[0].job_ids ?? []
    let candidates: WorkingSet['candidates'] = []
    let jobs: WorkingSet['jobs'] = []

    if (candIds.length) {
      const c = await pool.query(
        `SELECT id, short_id, candidate_name FROM resumes
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [opts.tenantId, candIds]
      )
      const order = new Map(candIds.map((id, i) => [id, i]))
      candidates = c.rows
        .map(r => ({
          id: r.id as string,
          name: r.candidate_name as string,
          short_id: r.short_id as string,
          rank: (order.get(r.id as string) ?? 0) + 1,
        }))
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    }
    if (jobIds.length) {
      const j = await pool.query(
        `SELECT id, short_id, title FROM job_posts
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [opts.tenantId, jobIds]
      )
      jobs = j.rows.map(r => ({
        id: r.id as string,
        title: r.title as string,
        short_id: r.short_id as string,
      }))
    }

    const ctx = (typeof rows[0].context === 'object' && rows[0].context) ? rows[0].context as Record<string, unknown> : {}
    return {
      notes: rows[0].notes ?? undefined,
      pinned_prompts: Array.isArray(ctx.pinned_prompts) ? ctx.pinned_prompts as string[] : [],
      working_set: {
        candidates,
        jobs,
        last_search: rows[0].last_search,
        compared_ids: Array.isArray(ctx.compared_ids) ? ctx.compared_ids as string[] : [],
        last_intent: typeof ctx.last_intent === 'string' ? ctx.last_intent : null,
      },
    }
  } catch {
    return { working_set: emptySet() }
  }
}

export async function saveWorkingMemory(opts: {
  tenantId: string
  userId: string
  memoryKey?: string
  workingSet?: WorkingSet
  notes?: string | null
  lastSearch?: string | null
  lastIntent?: string | null
}): Promise<void> {
  try {
    const ws = opts.workingSet ?? emptySet()
    const candidateIds = ws.candidates.map(c => c.id).filter(isValidUUID)
    const jobIds = ws.jobs.map(j => j.id).filter(isValidUUID)
    const context = {
      compared_ids: ws.compared_ids ?? [],
      last_intent: opts.lastIntent ?? ws.last_intent ?? null,
      pinned_prompts: [],
    }
    await pool.query(
      `INSERT INTO ai_working_memory
         (tenant_id, user_id, memory_key, context, candidate_ids, job_ids, last_search, notes, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::uuid[],$6::uuid[],$7,$8,NOW())
       ON CONFLICT (tenant_id, user_id, memory_key) DO UPDATE SET
         context = EXCLUDED.context,
         candidate_ids = EXCLUDED.candidate_ids,
         job_ids = EXCLUDED.job_ids,
         last_search = COALESCE(EXCLUDED.last_search, ai_working_memory.last_search),
         notes = COALESCE(EXCLUDED.notes, ai_working_memory.notes),
         updated_at = NOW()`,
      [
        opts.tenantId,
        opts.userId,
        opts.memoryKey ?? 'default',
        JSON.stringify(context),
        candidateIds,
        jobIds,
        opts.lastSearch ?? ws.last_search ?? null,
        opts.notes ?? null,
      ]
    )
  } catch (e) {
    console.warn('[aiMemory]', e instanceof Error ? e.message : e)
  }
}

/** Resolve phrases like "top 3", "candidate #2", "the Java candidates" against memory. */
export function resolveMemoryReferences(
  prompt: string,
  memory: MemoryContext,
): { resolvedPrompt: string; referencedCandidates: WorkingSet['candidates'] } {
  const p = prompt.toLowerCase()
  const cands = memory.working_set.candidates
  let referenced = [...cands]
  let resolved = prompt

  const hashMatch = p.match(/candidate\s*#?\s*(\d+)/i) || p.match(/#\s*(\d+)/)
  if (hashMatch) {
    const n = parseInt(hashMatch[1], 10)
    const hit = cands.find(c => c.rank === n) ?? cands[n - 1]
    if (hit) {
      referenced = [hit]
      resolved += `\n\n[MEMORY RESOLVED: candidate #${n} = ${hit.name} (${hit.short_id ?? hit.id})]`
    }
  }

  if (/\btop\s*3\b/.test(p) || /\bcompare\b/.test(p)) {
    referenced = cands.slice(0, 3)
    if (referenced.length) {
      resolved += `\n\n[MEMORY RESOLVED: top candidates = ${referenced.map((c, i) => `#${i + 1} ${c.name}`).join(', ')}]`
    }
  }

  if (/\bthose candidates\b|\bthe candidates\b|\bthem\b/.test(p) && cands.length) {
    referenced = cands
    resolved += `\n\n[MEMORY RESOLVED: working set candidates = ${cands.map(c => c.name).join(', ')}]`
  }

  if (memory.working_set.last_search) {
    resolved += `\n\n[MEMORY: last search = "${memory.working_set.last_search}"]`
  }

  return { resolvedPrompt: resolved, referencedCandidates: referenced }
}

/** After a search-like coach turn, refresh working set from SQL. */
export async function updateMemoryFromSearch(opts: {
  tenantId: string
  userId: string
  query: string
  limit?: number
}): Promise<WorkingSet> {
  const q = opts.query.trim()
  const like = `%${q.replace(/%/g, '')}%`
  try {
    const { rows } = await pool.query(
      `SELECT id, short_id, candidate_name,
              COALESCE(ai_score, 0) AS score
       FROM resumes
       WHERE tenant_id = $1
         AND (
           candidate_name ILIKE $2
           OR COALESCE(ai_summary,'') ILIKE $2
           OR EXISTS (
             SELECT 1 FROM unnest(COALESCE(ai_skills, ARRAY[]::text[])) s
             WHERE s ILIKE $2
           )
           OR candidate_profile::text ILIKE $2
         )
       ORDER BY COALESCE(ai_score, 0) DESC, created_at DESC
       LIMIT $3`,
      [opts.tenantId, like, opts.limit ?? 10]
    )
    const candidates = rows.map((r, i) => ({
      id: r.id as string,
      name: r.candidate_name as string,
      short_id: r.short_id as string,
      rank: i + 1,
    }))
    const ws: WorkingSet = {
      candidates,
      jobs: [],
      last_search: q,
      last_intent: 'search',
    }
    await saveWorkingMemory({
      tenantId: opts.tenantId,
      userId: opts.userId,
      workingSet: ws,
      lastSearch: q,
      lastIntent: 'search',
    })
    return ws
  } catch {
    return emptySet()
  }
}

export function formatMemoryBlock(memory: MemoryContext): string {
  const ws = memory.working_set
  const lines = [
    'AI RECRUITMENT MEMORY (authoritative for this conversation):',
    ws.last_search ? `- Last search: ${ws.last_search}` : '- Last search: (none)',
    ws.candidates.length
      ? `- Working candidates:\n${ws.candidates.map(c => `  #${c.rank} ${c.name} [${c.short_id ?? c.id}]`).join('\n')}`
      : '- Working candidates: (empty)',
    ws.jobs.length
      ? `- Working jobs:\n${ws.jobs.map(j => `  - ${j.title} [${j.short_id ?? j.id}]`).join('\n')}`
      : '- Working jobs: (empty)',
    memory.notes ? `- Recruiter notes: ${memory.notes}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}
