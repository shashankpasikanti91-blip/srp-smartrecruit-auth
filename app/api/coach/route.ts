import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { computeRecruiterKpi } from '@/lib/kpiEngine'

const COACH_SYSTEM = `You are SRP AI Recruiter Coach — a concise recruitment advisor for staffing agencies.
Give 3–5 actionable bullet suggestions for today based on the recruiter's KPI snapshot.
Focus on: follow-ups overdue, pipeline gaps, submission momentum, interview prep.
Keep under 200 words. Keep product naming aligned to SRP Smart Recruit. Professional tone.`

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ai_compose.use')
  if (ctx instanceof NextResponse) return ctx

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const kpi = await computeRecruiterKpi({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    days: 14,
  })

  const userPrompt = `Recruiter KPI (last ${kpi.period_days} days):
- Candidates added: ${kpi.candidates_added}
- AI screened: ${kpi.candidates_screened}
- Submissions: ${kpi.submissions}
- Interviews scheduled/completed: ${kpi.interviews_scheduled}/${kpi.interviews_completed}
- Comms sent: ${kpi.comms_sent}
- Follow-ups pending/overdue: ${kpi.follow_ups_pending}/${kpi.follow_ups_overdue}
- Active offers: ${kpi.offers_active}
- Pipeline: ${JSON.stringify(kpi.pipeline_by_stage)}

What should this recruiter prioritize today?`

  const baseUrl = process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENROUTER_API_KEY ? { 'HTTP-Referer': 'https://recruit.srpailabs.com' } : {}),
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_API_KEY ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: COACH_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.6,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[coach]', data)
      return NextResponse.json({ error: 'Coach request failed' }, { status: 502 })
    }
    const text = data.choices?.[0]?.message?.content ?? ''

    try {
      await pool.query(
        `INSERT INTO coach_suggestions (tenant_id, user_id, suggestions, kpi_snapshot)
         VALUES ($1,$2,$3,$4)`,
        [ctx.tenantId, ctx.userId, text, JSON.stringify(kpi)]
      )
    } catch { /* table may not exist */ }

    const historyRes = await pool.query(
      `SELECT suggestions, created_at FROM coach_suggestions
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 5`,
      [ctx.tenantId, ctx.userId]
    ).catch(() => ({ rows: [] }))

    return NextResponse.json({ suggestions: text, kpi, history: historyRes.rows })
  } catch (e) {
    console.error('[coach]', e)
    return NextResponse.json({ error: 'Coach unavailable' }, { status: 500 })
  }
}
