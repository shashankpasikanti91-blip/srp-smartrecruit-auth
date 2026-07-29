'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Award, Bell, Loader2, Send, Sparkles, TrendingUp, UserPlus, Users,
} from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'
import { FunnelDonut, PipelineBarChart } from '@/components/ui/KpiVisuals'
import { KpiGradientCard, type KpiTone } from '@/components/ui/KpiGradientCard'
import { KpiStripSkeleton } from '@/components/ui/Skeletons'

const PERIODS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
]

const TONES: KpiTone[] = ['g1', 'g2', 'g3', 'g4', 'g5', 'g7', 'g3', 'g6', 'g5']

type AiHistoryRow = {
  operation?: string
  model?: string
  prompt_tokens?: number
  completion_tokens?: number
  cost_usd?: number
  created_at?: string
}

export function MyPerformanceTab() {
  const [days, setDays] = useState(30)
  const [kpi, setKpi] = useState<RecruiterKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiHistory, setAiHistory] = useState<AiHistoryRow[]>([])
  const [aiUsage, setAiUsage] = useState<{ total_requests?: number; total_tokens?: number; estimated_cost_usd?: number }>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, profileRes] = await Promise.all([
        fetch(`/api/analytics/recruiter/me?days=${days}`),
        fetch('/api/profile'),
      ])
      const data = await kpiRes.json()
      setKpi(data.kpi ?? null)
      const profile = await profileRes.json().catch(() => ({}))
      setAiHistory(Array.isArray(profile.ai_history) ? profile.ai_history : [])
      setAiUsage({
        total_requests: profile.usage?.total_requests,
        total_tokens: profile.usage?.total_tokens,
        estimated_cost_usd: profile.usage?.estimated_cost_usd,
      })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const cards = kpi ? [
    { label: 'Candidates Added', value: kpi.candidates_added, sub: `${days}d window`, icon: <UserPlus className="w-4 h-4" />, trend: kpi.candidates_added > 0 ? 'up' as const : 'flat' as const },
    { label: 'AI Screened', value: kpi.candidates_screened, sub: 'Screened with AI', icon: <Sparkles className="w-4 h-4" />, trend: 'flat' as const },
    { label: 'Submissions', value: kpi.submissions, sub: 'Client submissions', icon: <Send className="w-4 h-4" />, trend: kpi.submissions > 0 ? 'up' as const : 'flat' as const },
    { label: 'Submit Rate', value: `${kpi.submission_conversion_rate}%`, sub: 'Conversion', icon: <TrendingUp className="w-4 h-4" />, trend: kpi.submission_conversion_rate >= 20 ? 'up' as const : 'flat' as const },
    { label: 'Interviews', value: `${kpi.interviews_scheduled}/${kpi.interviews_completed}`, sub: 'Scheduled / done', icon: <Users className="w-4 h-4" />, trend: 'flat' as const },
    { label: 'Interview Rate', value: `${kpi.interview_conversion_rate}%`, sub: 'Conversion', icon: <TrendingUp className="w-4 h-4" />, trend: 'flat' as const },
    { label: 'Comms Sent', value: kpi.comms_sent, sub: 'Messages', icon: <Send className="w-4 h-4" />, trend: 'flat' as const },
    { label: 'Follow-ups Overdue', value: kpi.follow_ups_overdue, sub: 'Needs attention', warn: kpi.follow_ups_overdue > 0, icon: <Bell className="w-4 h-4" />, trend: kpi.follow_ups_overdue > 0 ? 'down' as const : 'flat' as const },
    { label: 'Active Offers', value: kpi.offers_active, sub: 'In flight', icon: <Award className="w-4 h-4" />, trend: kpi.offers_active > 0 ? 'up' as const : 'flat' as const },
  ] : []

  const funnelSlices = kpi ? [
    { label: 'Candidates', value: kpi.candidates_added || 0, color: '#2563eb' },
    { label: 'Screened', value: kpi.candidates_screened || 0, color: '#7c3aed' },
    { label: 'Submissions', value: kpi.submissions || 0, color: '#0891b2' },
    { label: 'Interviews', value: kpi.interviews_scheduled || 0, color: '#ea580c' },
    { label: 'Offers', value: kpi.offers_active || 0, color: '#059669' },
  ] : []

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><TrendingUp className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">My Performance</h1>
            <p className="text-sm text-slate-500 mt-0.5">Personal recruitment KPIs — Power BI style</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${days === p.days ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <KpiStripSkeleton count={9} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {cards.map((c, i) => (
              <KpiGradientCard
                key={c.label}
                label={c.label}
                value={c.value}
                sub={c.sub}
                tone={TONES[i % TONES.length]}
                icon={c.icon}
                trend={c.trend}
                warn={c.warn}
              />
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            <FunnelDonut title={`Activity mix (${days}d)`} slices={funnelSlices} />
            <PipelineBarChart
              title={`Pipeline breakdown (${kpi?.period_days ?? days} day window)`}
              data={kpi?.pipeline_by_stage ?? {}}
            />
          </div>

          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" /> My AI Activity
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
                <span className="ui-badge ui-badge--purple">{aiUsage.total_requests ?? 0} requests</span>
                <span className="ui-badge ui-badge--cyan">{(aiUsage.total_tokens ?? 0).toLocaleString()} tokens</span>
                <span className="ui-badge ui-badge--green">${Number(aiUsage.estimated_cost_usd ?? 0).toFixed(4)}</span>
              </div>
            </div>
            {aiHistory.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium">No AI usage recorded yet this month. Generate a JD, screen a CV, or create posts to start tracking.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">Operation</th>
                      <th className="py-2 pr-3">Model</th>
                      <th className="py-2 pr-3">Tokens</th>
                      <th className="py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiHistory.slice(0, 15).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-600 whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-3 font-extrabold text-slate-800">{row.operation}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.model || '—'}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {((row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)).toLocaleString()}
                        </td>
                        <td className="py-2 tabular-nums">${Number(row.cost_usd ?? 0).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <p className="text-sm font-extrabold text-slate-900 mb-2">Recruiter tips</p>
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5 font-medium">
              <li>Improve submit rate by screening before client submission.</li>
              <li>Clear overdue follow-ups first — they block joining and offers.</li>
              <li>Use Generate Again only when you need a fresh AI result — cached results save tokens.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
