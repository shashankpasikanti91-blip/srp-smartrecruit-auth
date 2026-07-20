import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { loadWorkingMemory } from '@/lib/aiMemory'
import { listAgentSuggestions } from '@/lib/agentFramework'
import { listCollaborations } from '@/lib/agentCollaboration'
import { pool } from '@/lib/db'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (!(checkPermission(ctx.permissions, 'ai_compose.use') || checkPermission(ctx.permissions, 'ai_screen.use'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const memory = await loadWorkingMemory({ tenantId: ctx.tenantId, userId: ctx.userId })
  const suggestions = await listAgentSuggestions({ tenantId: ctx.tenantId, limit: 8 })
  const collabs = await listCollaborations({ tenantId: ctx.tenantId, limit: 5 })

  let followUps: unknown[] = []
  try {
    const { rows } = await pool.query(
      `SELECT id, title, due_at, status FROM follow_ups
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'pending'
       ORDER BY due_at ASC NULLS LAST LIMIT 8`,
      [ctx.tenantId, ctx.userId]
    )
    followUps = rows
  } catch { /* ignore */ }

  let savedSearches: unknown[] = []
  try {
    const { rows } = await pool.query(
      `SELECT id, name, query, created_at FROM ai_saved_searches
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 20`,
      [ctx.tenantId, ctx.userId]
    )
    savedSearches = rows
  } catch { /* ignore */ }

  const primaryCand = memory.working_set.candidates[0]
  const primaryJob = memory.working_set.jobs[0]

  return NextResponse.json({
    memory,
    candidate_context: primaryCand ?? null,
    job_context: primaryJob ?? null,
    recruiter_notes: memory.notes ?? '',
    suggested_actions: [
      ...collabs.slice(0, 2).map((c: { consolidated_title: string }) => c.consolidated_title),
      ...suggestions.slice(0, 4).map((s: { title: string }) => s.title),
    ],
    upcoming_followups: followUps,
    ai_recommendations: suggestions,
    collaborations: collabs,
    saved_searches: savedSearches,
  })
}
