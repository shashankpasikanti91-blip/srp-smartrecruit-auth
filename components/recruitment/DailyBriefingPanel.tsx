'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Sun } from 'lucide-react'

type Briefing = {
  date?: string
  narrative?: string
  new_candidates?: number
  pending_interviews?: { candidate_name?: string }[]
  waiting_feedback?: { candidate_name?: string }[]
  offers_pending?: { short_id?: string; status?: string }[]
  joining_this_week?: { candidate_name?: string }[]
  expiring_visas?: { candidate_name?: string; visa_expiry?: string }[]
  missing_documents?: number
  recruiter_performance?: {
    submissions?: number
    interviews_scheduled?: number
    offers_active?: number
    follow_ups_overdue?: number
  }
  ai_recommendations?: { title: string; rationale?: string | null }[]
  collaborations?: { id: string; title: string }[]
}

export function DailyBriefingPanel({
  onNavigate,
  className = '',
}: {
  onNavigate?: (tab: string) => void
  className?: string
}) {
  const [data, setData] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/briefing${refresh ? '?refresh=1' : ''}`)
      const json = await res.json().catch(() => ({}))
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rows: { label: string; value: string; tab?: string }[] = data
    ? [
        { label: 'New candidates', value: String(data.new_candidates ?? 0), tab: 'candidates' },
        { label: 'Interviews today', value: String(data.pending_interviews?.length ?? 0), tab: 'interviews' },
        { label: 'Waiting feedback', value: String(data.waiting_feedback?.length ?? 0), tab: 'interviews' },
        { label: 'Offers pending', value: String(data.offers_pending?.length ?? 0), tab: 'selected' },
        { label: 'Joining this week', value: String(data.joining_this_week?.length ?? 0), tab: 'selected' },
        { label: 'Visa expiry (30d)', value: String(data.expiring_visas?.length ?? 0), tab: 'candidates' },
        { label: 'Missing documents', value: String(data.missing_documents ?? 0), tab: 'documents' },
        {
          label: 'Your week',
          value: `${data.recruiter_performance?.submissions ?? 0} sub · ${data.recruiter_performance?.interviews_scheduled ?? 0} int · ${data.recruiter_performance?.offers_active ?? 0} offers`,
          tab: 'performance',
        },
      ]
    : []

  return (
    <div className={`ess-panel overflow-hidden ${className}`}>
      <div className="ess-panel__head">
        <p className="ess-panel__title flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-500" /> AI Daily Briefing
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-xs font-extrabold text-[var(--color-primary)] inline-flex items-center gap-1"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="p-4 space-y-3">
          {data?.narrative && (
            <pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap bg-amber-50/80 border border-amber-100 rounded-xl p-3">
              {data.narrative}
            </pre>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {rows.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => r.tab && onNavigate?.(r.tab)}
                className="text-left rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{r.label}</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{r.value}</p>
              </button>
            ))}
          </div>
          {(data?.ai_recommendations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-extrabold text-slate-700 mb-1.5">AI recommendations</p>
              <ul className="space-y-1">
                {data!.ai_recommendations!.slice(0, 4).map((a, i) => (
                  <li key={i} className="text-xs font-bold text-indigo-900 bg-indigo-50 rounded-lg px-2.5 py-1.5">
                    {a.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(data?.collaborations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-extrabold text-slate-700 mb-1.5">Agent collaborations</p>
              <ul className="space-y-1">
                {data!.collaborations!.map(c => (
                  <li key={c.id} className="text-xs font-bold text-teal-900 bg-teal-50 rounded-lg px-2.5 py-1.5">
                    {c.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
