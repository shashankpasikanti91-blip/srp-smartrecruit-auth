import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission, type TenantContext } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { computeRecruiterKpi } from '@/lib/kpiEngine'
import { sanitizeText, isValidUUID } from '@/lib/validate'
import {
  loadWorkingMemory,
  resolveMemoryReferences,
  updateMemoryFromSearch,
  formatMemoryBlock,
  saveWorkingMemory,
} from '@/lib/aiMemory'
import { analyzeJobFillDifficulty, formatMarketInsightForPrompt } from '@/lib/marketIntelligence'
import { chatCompletion, getAIConfig } from '@/lib/aiClient'

const COPILOT_SYSTEM = `You are SmartRecruit AI — a Senior Recruitment Director with 20+ years of staffing / agency hiring experience (Malaysia, SEA, India, GCC aware).

NEVER answer like a generic chatbot. NEVER give vague dashboard tips unless the user explicitly asks for daily priorities.

Intent detection (always):
1. JD / job description / short phrases like "Java Developer JD Kuala Lumpur" → Complete professional JD pack with ALL sections:
   Full JD, Responsibilities, Required skills, Nice-to-have skills, Salary guidance, Boolean search, LinkedIn search, JobStreet search, Screening questions, Technical interview Qs, HR interview Qs, Hiring difficulty, Source strategy.
2. WhatsApp / follow-up message → Ready-to-send message only (plus 1 optional shorter variant).
3. Compare candidates → Comparison table: strengths, weaknesses, hiring recommendation, risk analysis, AI match score.
4. Sourcing → Job portals, communities, keywords, alternative titles, nearby countries, salary bands, hiring difficulty.
5. Boolean / LinkedIn / JobStreet search → Ready-to-paste strings.
6. Offer / rejection / interview invite → Ready-to-send professional copy.
7. Tenant analytics → Use TENANT WORKSPACE CONTEXT only; do not invent metrics.

Clarifying questions:
- If the user asks for a JD / role pack but role title OR location OR seniority is clearly missing, ask 1–3 short clarifying questions instead of inventing. Do not invent city or seniority.

Rules:
- Search / use tenant data FIRST. If data exists, answer from it. If not: say "I could not find this in your recruitment data." then generate professional recruitment content labeled as guidance.
- Be commercial, precise, structured with markdown. Product name: SRP SmartRecruit.
- Use conversation history AND AI RECRUITMENT MEMORY for multi-turn continuity (e.g. "compare the top 3", "email candidate #2").
- For market / hiring difficulty questions, ground answers in MARKET INTELLIGENCE signals when provided — salary vs tenant peers, pool size, rare skills, SLA — never invent external survey numbers.`

function detectIntent(prompt: string): { mode: string; maxTokens: number; hint: string } {
  const p = prompt.toLowerCase()
  if (/\b(why .{0,40}difficult|hard to fill|hiring difficulty|market (intel|intelligence)|talent shortage|fill rate)\b/.test(p)) {
    return {
      mode: 'market',
      maxTokens: 1600,
      hint: 'Explain hiring difficulty with concrete reasons: salary vs market (tenant peers), notice period, rare skills, location pool. Use MARKET INTELLIGENCE block.',
    }
  }
  if (/\b(find|search|show).{0,20}(candidate|java|react|python|sap|engineer|developer)\b/.test(p)
    || /\bcandidates?\s+for\b/.test(p)) {
    return {
      mode: 'search',
      maxTokens: 1200,
      hint: 'List matching candidates from tenant data as a ranked table. Remember them in working memory for follow-ups like "compare top 3".',
    }
  }
  if (/\b(jd|job description|role brief|generate .{0,50}\bjd\b|write .{0,40}(jd|job description))\b/.test(p)
    || (/\b(developer|engineer|analyst|manager|consultant|designer)\b/.test(p) && /\b(jd|kuala|kl|malaysia|singapore|remote|senior|junior)\b/.test(p))
    || (p.includes('generate') && (p.includes('developer') || p.includes('engineer') || p.includes('java') || p.includes('react') || p.includes('sap')))) {
    return {
      mode: 'jd',
      maxTokens: 3200,
      hint: 'Return a COMPLETE JD pack: Full JD, Responsibilities, Required / Nice-to-have skills, Salary guidance, Boolean, LinkedIn search, JobStreet search, Screening Qs, Technical / HR interview Qs, Hiring difficulty, Source strategy. If role OR location OR seniority is missing, ask 1–3 clarifying questions instead.',
    }
  }
  if (/\b(whatsapp|wa follow|follow-?up message|ready.?to.?send|email candidate)\b/.test(p)) {
    return { mode: 'whatsapp', maxTokens: 800, hint: 'Return a ready-to-send message. If MEMORY names a candidate #N, address that person by name.' }
  }
  if (/\b(compare|vs\.?|versus|top\s*3)\b/.test(p)) {
    return { mode: 'compare', maxTokens: 1600, hint: 'Compare candidates from AI RECRUITMENT MEMORY / tenant data. Strengths, weaknesses, hiring recommendation, risk, AI fit.' }
  }
  if (/\b(where (can|do) i source|sourcing|source .{0,30}consultant|how to find)\b/.test(p)) {
    return { mode: 'sourcing', maxTokens: 1600, hint: 'Return portals, communities, keywords, alternative titles, nearby countries, salary, hiring difficulty.' }
  }
  if (/\b(boolean|linkedin search|jobstreet)\b/.test(p)) {
    return { mode: 'boolean', maxTokens: 1000, hint: 'Return ready-to-paste boolean / LinkedIn / JobStreet search strings.' }
  }
  if (/\b(missing documents?|doc gaps?|which candidates?.{0,40}missing|documents? outstanding)\b/.test(p)) {
    return {
      mode: 'docs',
      maxTokens: 1200,
      hint: 'List candidates with missing / pending / rejected documents from TENANT DATA (DOC GAPS). Be specific by name. Suggest WhatsApp chase message.',
    }
  }
  if (/\b(joining this week|join(ing)? (this|next) week|expected joining|who.?s joining|start(s|ing) this week)\b/.test(p)) {
    return {
      mode: 'joining',
      maxTokens: 1200,
      hint: 'List candidates/offers with expected_joining this week from TENANT DATA. Flag missing docs and follow-ups. Recruiter action list.',
    }
  }
  if (/\b(offer letter|rejection|interview (invite|questions)|screen(ing)? questions)\b/.test(p)) {
    return { mode: 'compose', maxTokens: 1400, hint: 'Return ready-to-use professional recruitment copy. Use MEMORY candidate/job when referenced.' }
  }
  return { mode: 'chat', maxTokens: 1400, hint: 'Answer as Senior Recruitment Director. Tenant data + MEMORY first. Never generic chatbot fluff.' }
}

function needsClarifyingQuestions(prompt: string, mode: string): string | null {
  if (mode !== 'jd') return null
  const p = prompt.toLowerCase()
  const hasRole = /\b(developer|engineer|analyst|manager|consultant|designer|accountant|nurse|teacher|sales|marketing|hr|recruiter|java|react|\.net|python|sap|fico)\b/.test(p)
  const hasLocation = /\b(kuala|lumpur|kl|malaysia|singapore|india|dubai|uae|sydney|melbourne|toronto|remote|penang|jb|johor)\b/.test(p)
  const hasSeniority = /\b(junior|mid|senior|lead|principal|intern|entry|staff|director)\b/.test(p)
  const missing: string[] = []
  if (!hasRole) missing.push('What is the exact role / job title?')
  if (!hasLocation) missing.push('Which city / country (or remote)?')
  if (!hasSeniority) missing.push('What seniority level (junior / mid / senior / lead)?')
  if (missing.length === 0) return null
  if (missing.length === 3 && prompt.trim().split(/\s+/).length < 4) {
    return `Before I draft the full JD pack, I need a bit more detail:\n\n1. ${missing[0]}\n2. ${missing[1]}\n3. ${missing[2]}`
  }
  if (missing.length >= 2 && !hasRole) {
    return `Quick clarifiers so I don’t invent details:\n\n1. ${missing[0]}\n2. ${missing[1]}${missing[2] ? `\n3. ${missing[2]}` : ''}`
  }
  return null
}

function canUseCoach(ctx: TenantContext): boolean {
  return (
    checkPermission(ctx.permissions, 'ai_compose.use') ||
    checkPermission(ctx.permissions, 'ai_screen.use')
  )
}

async function loadHistory(tenantId: string, userId: string) {
  try {
    const historyRes = await pool.query(
      `SELECT suggestions, created_at FROM coach_suggestions
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 5`,
      [tenantId, userId]
    )
    return historyRes.rows as { suggestions: string; created_at: string }[]
  } catch {
    return []
  }
}

async function loadTenantRag(tenantId: string) {
  const jobs = await pool.query(
    `SELECT short_id, title, company, location, status, priority
     FROM job_posts WHERE tenant_id = $1 AND status != 'archived'
     ORDER BY created_at DESC LIMIT 10`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const candidates = await pool.query(
    `SELECT short_id, candidate_name, pipeline_stage, created_at
     FROM resumes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 8`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const submissions = await pool.query(
    `SELECT short_id, stage, client_name, updated_at
     FROM submissions WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 8`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const offers = await pool.query(
    `SELECT short_id, status, expected_joining FROM offer_cases
     WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 6`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const joiningThisWeek = await pool.query(
    `SELECT o.short_id, o.status, o.expected_joining, r.candidate_name
     FROM offer_cases o
     JOIN resumes r ON r.id = o.resume_id
     WHERE o.tenant_id = $1
       AND o.expected_joining IS NOT NULL
       AND o.expected_joining::date >= date_trunc('week', CURRENT_DATE)::date
       AND o.expected_joining::date < (date_trunc('week', CURRENT_DATE) + interval '7 days')::date
     ORDER BY o.expected_joining ASC
     LIMIT 15`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const templates = await pool.query(
    `SELECT template_type, name, country_code FROM hr_templates
     WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 8`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const docGaps = await pool.query(
    `SELECT r.candidate_name, COUNT(*)::int AS n
     FROM candidate_documents d
     JOIN resumes r ON r.id = d.resume_id
     WHERE r.tenant_id = $1
       AND COALESCE(d.verification_status,'pending_verification') IN
         ('pending_verification','rejected','replacement_requested','expired')
     GROUP BY r.candidate_name ORDER BY n DESC LIMIT 5`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  const overdue = await pool.query(
    `SELECT title, due_at FROM follow_ups
     WHERE tenant_id = $1 AND status = 'pending' AND due_at < NOW()
     ORDER BY due_at ASC LIMIT 6`,
    [tenantId]
  ).catch(() => ({ rows: [] }))

  return {
    jobs: jobs.rows,
    candidates: candidates.rows,
    submissions: submissions.rows,
    offers: offers.rows,
    joiningThisWeek: joiningThisWeek.rows,
    templates: templates.rows,
    docGaps: docGaps.rows,
    overdue: overdue.rows,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  if (!canUseCoach(ctx)) {
    return NextResponse.json(
      { error: 'Forbidden: SmartRecruit AI requires ai_compose or ai_screen permission', history: [] },
      { status: 403 }
    )
  }

  const history = await loadHistory(ctx.tenantId, ctx.userId)
  return NextResponse.json({ history })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  if (!canUseCoach(ctx)) {
    return NextResponse.json(
      { error: 'Forbidden: SmartRecruit AI requires ai_compose or ai_screen permission in this workspace' },
      { status: 403 }
    )
  }

  const aiCfg = getAIConfig()
  if (!aiCfg) {
    return NextResponse.json({ error: 'AI not configured — set OPENAI_API_KEY in .env' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const prompt = sanitizeText(body.prompt ?? body.message ?? body.query, 4000)?.trim() ?? ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id : null

  type Turn = { role: 'user' | 'assistant' | 'system'; content: string }
  const incomingMessages: Turn[] = Array.isArray(body.messages)
    ? (body.messages as Turn[])
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
        .map(m => ({ role: m.role, content: sanitizeText(m.content, 4000) ?? '' }))
        .filter(m => m.content)
    : []

  const lastUserRaw = prompt || [...incomingMessages].reverse().find(m => m.role === 'user')?.content || ''
  const intent = detectIntent(lastUserRaw || 'daily priorities')

  // AI Recruitment Memory
  let memory = await loadWorkingMemory({ tenantId: ctx.tenantId, userId: ctx.userId })
  if (intent.mode === 'search' && lastUserRaw) {
    const searchQ = lastUserRaw.replace(/^(find|search|show)\s+/i, '').trim()
    const ws = await updateMemoryFromSearch({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      query: searchQ.slice(0, 120),
    })
    memory = { ...memory, working_set: ws }
  }
  const { resolvedPrompt: lastUser, referencedCandidates } = resolveMemoryReferences(lastUserRaw, memory)

  const clarify = needsClarifyingQuestions(lastUserRaw, intent.mode)
  if (clarify) {
    try {
      await pool.query(
        `INSERT INTO coach_suggestions (tenant_id, user_id, suggestions, kpi_snapshot)
         VALUES ($1,$2,$3,$4)`,
        [ctx.tenantId, ctx.userId, clarify, JSON.stringify({ mode: 'clarify', prompt: lastUserRaw.slice(0, 500) })]
      )
    } catch { /* ignore */ }
    return NextResponse.json({ suggestions: clarify, mode: 'clarify', clarifying: true, memory })
  }

  const kpi = await computeRecruiterKpi({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    days: 14,
  })
  const rag = await loadTenantRag(ctx.tenantId)

  let marketBlock = ''
  if (intent.mode === 'market' || /difficult|hard to fill/i.test(lastUserRaw)) {
    try {
      const jobId = memory.working_set.jobs[0]?.id
        ?? (await pool.query(
          `SELECT id FROM job_posts WHERE tenant_id = $1 AND status NOT IN ('archived','closed')
           AND title ILIKE '%java%' ORDER BY updated_at DESC LIMIT 1`,
          [ctx.tenantId]
        ).then(r => r.rows[0]?.id as string | undefined))
      if (jobId) {
        const insight = await analyzeJobFillDifficulty({ tenantId: ctx.tenantId, jobId })
        const title = memory.working_set.jobs[0]?.title
        marketBlock = '\n\n' + formatMarketInsightForPrompt(insight, title)
      }
    } catch { /* ignore */ }
  }

  const tenantBlock = `TENANT SQL RAG CONTEXT (authoritative — do not invent metrics):
KPI last ${kpi.period_days} days:
- Candidates added: ${kpi.candidates_added}
- AI screened: ${kpi.candidates_screened}
- Submissions: ${kpi.submissions}
- Interviews scheduled/completed: ${kpi.interviews_scheduled}/${kpi.interviews_completed}
- Comms sent: ${kpi.comms_sent}
- Follow-ups pending/overdue: ${kpi.follow_ups_pending}/${kpi.follow_ups_overdue}
- Active offers: ${kpi.offers_active}
- Pipeline by stage: ${JSON.stringify(kpi.pipeline_by_stage)}

${formatMemoryBlock(memory)}
${referencedCandidates.length ? `Referenced now: ${referencedCandidates.map(c => `#${c.rank} ${c.name}`).join(', ')}` : ''}

Open/recent jobs:
${rag.jobs.length === 0 ? '(none)' : rag.jobs.map((j: Record<string, unknown>) => `- [${j.short_id}] ${j.title} @ ${j.company ?? '—'} | ${j.location ?? '—'} | ${j.status} | ${j.priority ?? ''}`).join('\n')}

Recent candidates:
${rag.candidates.length === 0 ? '(none)' : rag.candidates.map((c: Record<string, unknown>) => `- [${c.short_id}] ${c.candidate_name} · ${c.pipeline_stage ?? '—'}`).join('\n')}

Recent submissions:
${rag.submissions.length === 0 ? '(none)' : rag.submissions.map((s: Record<string, unknown>) => `- [${s.short_id}] ${s.stage} · ${s.client_name ?? ''}`).join('\n')}

Recent offers:
${rag.offers.length === 0 ? '(none)' : rag.offers.map((o: Record<string, unknown>) => `- [${o.short_id}] ${o.status} · joining ${o.expected_joining ?? '—'}`).join('\n')}

Joining this week:
${rag.joiningThisWeek.length === 0 ? '(none)' : rag.joiningThisWeek.map((o: Record<string, unknown>) => `- ${o.candidate_name} [${o.short_id}] ${o.status} · ${o.expected_joining}`).join('\n')}

HR templates:
${rag.templates.length === 0 ? '(none)' : rag.templates.map((t: Record<string, unknown>) => `- ${t.template_type}: ${t.name} (${t.country_code ?? '—'})`).join('\n')}

Document checklist gaps:
${rag.docGaps.length === 0 ? '(none)' : rag.docGaps.map((d: Record<string, unknown>) => `- ${d.candidate_name}: ${d.n} docs needing attention`).join('\n')}

Overdue follow-ups:
${rag.overdue.length === 0 ? '(none)' : rag.overdue.map((f: Record<string, unknown>) => `- ${f.title} (due ${f.due_at})`).join('\n')}
${marketBlock}
`

  const systemContent = `${COPILOT_SYSTEM}

${tenantBlock}

INTENT MODE: ${intent.mode}
INSTRUCTION: ${intent.hint}`

  const messages: Turn[] = [{ role: 'system', content: systemContent }]
  if (incomingMessages.length > 0) {
    messages.push(...incomingMessages)
    if (lastUser && incomingMessages[incomingMessages.length - 1]?.content !== lastUserRaw) {
      messages.push({ role: 'user', content: lastUser })
    } else if (lastUser !== lastUserRaw) {
      // inject resolved memory as a follow-up system note already in system; keep last user as-is
    }
  } else {
    messages.push({
      role: 'user',
      content: lastUser
        || 'What should this recruiter prioritize today based on the KPI snapshot? Give 3–5 actionable bullets under 200 words as a Senior Recruitment Director.',
    })
  }

  const maxTokens = lastUserRaw || incomingMessages.length ? intent.maxTokens : 400

  try {
    const text = await chatCompletion({
      messages,
      max_tokens: maxTokens,
      temperature: intent.mode === 'jd' ? 0.55 : 0.6,
    })

    try {
      await pool.query(
        `INSERT INTO coach_suggestions (tenant_id, user_id, suggestions, kpi_snapshot)
         VALUES ($1,$2,$3,$4)`,
        [ctx.tenantId, ctx.userId, text, JSON.stringify({ kpi, prompt: lastUser.slice(0, 500), mode: intent.mode })]
      )
    } catch (e) {
      console.warn('[coach] history insert skipped:', e instanceof Error ? e.message : e)
    }

    // Optional session persistence (UUID sessions only)
    if (sessionId && isValidUUID(sessionId)) {
      try {
        const persisted = [
          ...incomingMessages,
          ...(prompt ? [{ role: 'user' as const, content: prompt }] : []),
          { role: 'assistant' as const, content: text },
        ].slice(-20)
        await pool.query(
          `INSERT INTO coach_sessions (id, tenant_id, user_id, title, messages, updated_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,NOW())
           ON CONFLICT (id) DO UPDATE SET messages = $5::jsonb, updated_at = NOW()`,
          [
            sessionId,
            ctx.tenantId,
            ctx.userId,
            lastUser.slice(0, 80) || 'New chat',
            JSON.stringify(persisted),
          ]
        )
      } catch {
        /* table may lack unique on id-only upsert — try update */
        try {
          await pool.query(
            `UPDATE coach_sessions SET messages = $1::jsonb, updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3 AND user_id = $4`,
            [
              JSON.stringify([
                ...incomingMessages,
                { role: 'assistant', content: text },
              ].slice(-20)),
              sessionId,
              ctx.tenantId,
              ctx.userId,
            ]
          )
        } catch { /* ignore */ }
      }
    }

    const history = await loadHistory(ctx.tenantId, ctx.userId)
    await saveWorkingMemory({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workingSet: memory.working_set,
      lastIntent: intent.mode,
    })
    return NextResponse.json({
      suggestions: text,
      kpi,
      history,
      mode: intent.mode,
      memory,
      cards: {
        candidates: memory.working_set.candidates.slice(0, 5),
        jobs: memory.working_set.jobs.slice(0, 3),
      },
    })
  } catch (e) {
    console.error('[coach]', e)
    return NextResponse.json({ error: 'SmartRecruit AI unavailable' }, { status: 500 })
  }
}
