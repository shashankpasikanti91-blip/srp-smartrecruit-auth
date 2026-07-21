'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, TrendingUp } from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'
import { FunnelDonut, PipelineBarChart } from '@/components/ui/KpiVisuals'

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

  const funnelSlices = kpi ? [
    { label: 'Candidates', value: kpi.candidates_added || 0, color: '#4f46e5' },
    { label: 'Screened', value: kpi.candidates_screened || 0, color: '#7c3aed' },
    { label: 'Submissions', value: kpi.submissions || 0, color: '#0284c7' },
    { label: 'Interviews', value: kpi.interviews_scheduled || 0, color: '#d97706' },
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
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${days === p.days ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {cards.map(c => (
              <div key={c.label} className={`rounded-xl border p-4 shadow-sm ${c.warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{c.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            <FunnelDonut title={`Activity mix (${days}d)`} slices={funnelSlices} />
            <PipelineBarChart
              title={`Pipeline breakdown (${kpi?.period_days ?? days} day window)`}
              data={kpi?.pipeline_by_stage ?? {}}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <p className="text-sm font-extrabold text-slate-900 mb-2">Recruiter tips</p>
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5 font-medium">
              <li>Improve submit rate by screening before client submission.</li>
              <li>Clear overdue follow-ups first — they block joining and offers.</li>
              <li>Use AI Workspace for JD packs, boolean strings, and missing-document chase.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
