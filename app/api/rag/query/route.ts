import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { retrieveChunks, formatChunksForPrompt } from '@/lib/rag/retrieve'
import { ragAnswerLoop } from '@/lib/rag/loop'
import { logAiAction } from '@/lib/aiSecurity'

/**
 * POST /api/rag/query
 * Tenant-scoped vector retrieve (+ optional citation loop).
 * Body: { q, top_k?, source_type?, loop? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const can =
    checkPermission(ctx.permissions, 'ai_compose.use') ||
    checkPermission(ctx.permissions, 'ai_screen.use') ||
    ctx.tenantRole === 'owner' ||
    ctx.tenantRole === 'admin' ||
    ctx.tenantRole === 'recruiter'
  if (!can) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    q?: string
    top_k?: number
    source_type?: 'resume' | 'job'
    loop?: boolean
  }
  const q = (body.q || '').trim()
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const allowResumes = checkPermission(ctx.permissions, 'candidates.read')
  const allowJobs = checkPermission(ctx.permissions, 'jobs.read')

  if (body.loop) {
    const result = await ragAnswerLoop({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      query: q,
      topK: body.top_k,
      allowResumes,
      allowJobs,
    })
    await logAiAction({
      ctx,
      action: 'ai_rag_query',
      resourceType: 'rag',
      details: { loop: true, chunks: result.chunks.length },
    })
    return NextResponse.json({
      loop: true,
      answer: result.answer,
      chunks: result.chunks,
      retried: result.retried,
      grounded_citations: result.grounded,
      context_preview: formatChunksForPrompt(result.chunks),
    })
  }

  const chunks = await retrieveChunks({
    tenantId: ctx.tenantId,
    query: q,
    topK: body.top_k,
    sourceType: body.source_type ?? null,
    userId: ctx.userId,
    allowResumes,
    allowJobs,
  })
  await logAiAction({
    ctx,
    action: 'ai_rag_query',
    resourceType: 'rag',
    details: { loop: false, chunks: chunks.length },
  })

  return NextResponse.json({
    loop: false,
    chunks,
    context_preview: formatChunksForPrompt(chunks),
  })
}
