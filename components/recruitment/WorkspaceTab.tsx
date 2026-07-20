'use client'

import { useCallback, useEffect, useState } from 'react'
import { Brain, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'

export function WorkspaceTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [kpi, setKpi] = useState<RecruiterKpi | null>(null)
  const [coach, setCoach] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachLoading, setCoachLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/recruiter/me?days=30')
      const data = await res.json()
      setKpi(data.kpi ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadCoach = async () => {
    setCoachLoading(true)
    try {
      const res = await fetch('/api/coach', { method: 'POST' })
      const data = await res.json()
      setCoach(data.suggestions ?? data.error ?? 'Coach unavailable')
    } finally {
      setCoachLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  const cards = kpi ? [
    { label: 'Candidates added', value: kpi.candidates_added },
    { label: 'AI screened', value: kpi.candidates_screened },
    { label: 'Submissions', value: kpi.submissions },
    { label: 'Interviews', value: `${kpi.interviews_scheduled}/${kpi.interviews_completed}` },
    { label: 'Comms sent', value: kpi.comms_sent },
    { label: 'Follow-ups overdue', value: kpi.follow_ups_overdue, warn: kpi.follow_ups_overdue > 0 },
    { label: 'Active offers', value: kpi.offers_active },
  ] : []

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><TrendingUp className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">My Workspace</h1>
            <p className="text-sm text-slate-500 mt-0.5">Your recruitment hub — last 30 days</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">Quick links</p>
          <div className="flex flex-wrap gap-2">
            {[
              { tab: 'followups', label: 'Follow-ups' },
              { tab: 'interviews', label: 'Interviews' },
              { tab: 'submissions', label: 'Submissions' },
              { tab: 'candidates', label: 'Candidates' },
            ].map(l => (
              <button key={l.tab} type="button" onClick={() => onNavigate?.(l.tab)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100">
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> AI Recruiter Coach
            </p>
            <button type="button" onClick={loadCoach} disabled={coachLoading}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50">
              {coachLoading ? 'Thinking…' : 'Get suggestions'}
            </button>
          </div>
          {coach ? (
            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{coach}</div>
          ) : (
            <p className="text-sm text-slate-500">Daily AI suggestions based on your KPI snapshot.</p>
          )}
        </div>
      </div>

      {kpi && Object.keys(kpi.pipeline_by_stage).length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" /> Your pipeline
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(kpi.pipeline_by_stage).map(([stage, count]) => (
              <span key={stage} className="text-xs capitalize px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {stage}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
