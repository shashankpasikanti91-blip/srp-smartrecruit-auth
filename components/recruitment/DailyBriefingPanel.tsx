'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Calendar, FileWarning, Loader2, RefreshCw, Sparkles, Sun, Target, Zap,
} from 'lucide-react'

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

  const interviewNames = [
    ...(data?.pending_interviews ?? []).map(i => i.candidate_name).filter(Boolean),
    ...(data?.waiting_feedback ?? []).map(i => i.candidate_name).filter(Boolean),
  ].slice(0, 4) as string[]

  const followUps = data?.recruiter_performance?.follow_ups_overdue ?? 0

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
            <pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-100 rounded-xl p-3">
              {data.narrative}
            </pre>
          )}

          <div className="briefing-grid">
            <div className="briefing-section">
              <p className="briefing-section__title"><Target className="w-3.5 h-3.5 text-blue-600" /> Today&apos;s priorities</p>
              <ul className="space-y-1.5 text-sm font-semibold text-slate-800">
                <li className="flex justify-between gap-2">
                  <span>New candidates</span>
                  <button type="button" className="tabular-nums text-blue-700 font-extrabold" onClick={() => onNavigate?.('candidates')}>{data?.new_candidates ?? 0}</button>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Offers pending</span>
                  <button type="button" className="tabular-nums text-emerald-700 font-extrabold" onClick={() => onNavigate?.('selected')}>{data?.offers_pending?.length ?? 0}</button>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Joining this week</span>
                  <span className="tabular-nums font-extrabold">{data?.joining_this_week?.length ?? 0}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Visa expiry (30d)</span>
                  <button type="button" className="tabular-nums text-rose-700 font-extrabold" onClick={() => onNavigate?.('candidates')}>{data?.expiring_visas?.length ?? 0}</button>
                </li>
              </ul>
            </div>

            <div className="briefing-section">
              <p className="briefing-section__title"><Calendar className="w-3.5 h-3.5 text-orange-600" /> Interviews</p>
              {(data?.pending_interviews?.length ?? 0) + (data?.waiting_feedback?.length ?? 0) === 0 ? (
                <p className="text-sm font-medium text-slate-500">No interviews needing attention</p>
              ) : (
                <ul className="space-y-1 text-sm font-semibold text-slate-800">
                  <li className="text-xs text-slate-500 font-bold mb-1">
                    {data?.pending_interviews?.length ?? 0} scheduled · {data?.waiting_feedback?.length ?? 0} awaiting feedback
                  </li>
                  {interviewNames.map((n, i) => (
                    <li key={i} className="truncate">{n}</li>
                  ))}
                </ul>
              )}
              <button type="button" className="mt-2 text-[11px] font-extrabold text-orange-700" onClick={() => onNavigate?.('interviews')}>
                Open interviews →
              </button>
            </div>

            <div className="briefing-section">
              <p className="briefing-section__title"><FileWarning className="w-3.5 h-3.5 text-rose-600" /> Documents</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{data?.missing_documents ?? 0}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Missing documents in collection</p>
              <button type="button" className="mt-2 text-[11px] font-extrabold text-rose-700" onClick={() => onNavigate?.('documents')}>
                Review documents →
              </button>
            </div>

            <div className="briefing-section">
              <p className="briefing-section__title"><Zap className="w-3.5 h-3.5 text-amber-600" /> Follow-ups</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{followUps}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Overdue follow-ups this week</p>
              <p className="text-xs font-semibold text-slate-600 mt-2">
                Week: {data?.recruiter_performance?.submissions ?? 0} sub · {data?.recruiter_performance?.interviews_scheduled ?? 0} int · {data?.recruiter_performance?.offers_active ?? 0} offers
              </p>
              <button type="button" className="mt-2 text-[11px] font-extrabold text-amber-700" onClick={() => onNavigate?.('followups')}>
                Clear follow-ups →
              </button>
            </div>

            <div className="briefing-section">
              <p className="briefing-section__title"><Sparkles className="w-3.5 h-3.5 text-violet-600" /> AI recommendations</p>
              {(data?.ai_recommendations?.length ?? 0) === 0 ? (
                <p className="text-sm font-medium text-slate-500">No recommendations yet</p>
              ) : (
                <ul className="space-y-1.5">
                  {data!.ai_recommendations!.slice(0, 4).map((a, i) => (
                    <li key={i} className="text-xs font-bold text-violet-900 bg-violet-50 rounded-lg px-2.5 py-1.5 border border-violet-100">
                      {a.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="briefing-section">
              <p className="briefing-section__title"><Sun className="w-3.5 h-3.5 text-indigo-600" /> Quick actions</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Candidates', tab: 'candidates' },
                  { label: 'Jobs', tab: 'jobs' },
                  { label: 'AI Screen', tab: 'screen' },
                  { label: 'Performance', tab: 'performance' },
                  { label: 'AI Hub', tab: 'coach' },
                ].map(a => (
                  <button
                    key={a.tab}
                    type="button"
                    onClick={() => onNavigate?.(a.tab)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {(data?.collaborations?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-1">
                  {data!.collaborations!.slice(0, 2).map(c => (
                    <li key={c.id} className="text-xs font-bold text-teal-900 bg-teal-50 rounded-lg px-2.5 py-1.5">
                      {c.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
