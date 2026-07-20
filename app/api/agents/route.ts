import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import {
  listAgentSuggestions,
  resolveSuggestion,
  runAgentSweep,
} from '@/lib/agentFramework'
import { listCollaborations, resolveCollaboration } from '@/lib/agentCollaboration'
import { isValidUUID } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10))
  const includeCollab = req.nextUrl.searchParams.get('collaborations') !== '0'
  const suggestions = await listAgentSuggestions({
    tenantId: ctx.tenantId,
    status,
    limit,
  })
  const collaborations = includeCollab
    ? await listCollaborations({ tenantId: ctx.tenantId, status, limit: 20 })
    : []
  return NextResponse.json({ suggestions, collaborations })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'sweep') {
    const result = await runAgentSweep({ tenantId: ctx.tenantId, userId: ctx.userId })
    return NextResponse.json(result)
  }

  if (action === 'accept_collab' || action === 'dismiss_collab') {
    const id = body.id as string
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Valid id required' }, { status: 400 })
    }
    const row = await resolveCollaboration({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      id,
      action: action === 'accept_collab' ? 'accepted' : 'dismissed',
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true, collaboration: row })
  }

  if (action === 'accept' || action === 'dismiss') {
    const id = body.id as string
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Valid id required' }, { status: 400 })
    }
    const result = await resolveSuggestion({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      id,
      action: action === 'accept' ? 'accepted' : 'dismissed',
    })
    if (!result.ok) {
      return NextResponse.json({ error: 'Suggestion not found or already resolved' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, suggestion: result.suggestion })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
