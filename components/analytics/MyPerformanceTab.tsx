'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, TrendingUp } from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'

const PERIODS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
]

export function MyPerformanceTab() {
  const [days, setDays] = useState(30)
  const [kpi, setKpi] = useState<RecruiterKpi | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/recruiter/me?days=${days}`)
      const data = await res.json()
      setKpi(data.kpi ?? null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const cards = kpi ? [
    { label: 'Candidates Added', value: kpi.candidates_added },
    { label: 'AI Screened', value: kpi.candidates_screened },
    { label: 'Submissions', value: kpi.submissions },
    { label: 'Submit Rate', value: `${kpi.submission_conversion_rate}%` },
    { label: 'Interviews', value: `${kpi.interviews_scheduled}/${kpi.interviews_completed}` },
    { label: 'Interview Rate', value: `${kpi.interview_conversion_rate}%` },
    { label: 'Comms Sent', value: kpi.comms_sent },
    { label: 'Follow-ups Overdue', value: kpi.follow_ups_overdue, warn: kpi.follow_ups_overdue > 0 },
    { label: 'Active Offers', value: kpi.offers_active },
  ] : []

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><TrendingUp className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">My Performance</h1>
            <p className="text-sm text-slate-500 mt-0.5">Personal recruitment KPIs</p>
          </div>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${days === p.days ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
            {cards.map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>
          {kpi && Object.keys(kpi.pipeline_by_stage).length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-bold text-slate-900 mb-3">Pipeline breakdown ({kpi.period_days} day window)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(kpi.pipeline_by_stage).map(([stage, count]) => (
                  <span key={stage} className="text-xs capitalize px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                    {stage}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
