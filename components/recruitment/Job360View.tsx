'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Loader2, TrendingUp, X } from 'lucide-react'
import { AiFitScoreCard } from '@/components/recruitment/AiFitScoreCard'
import type { AiFitScores } from '@/lib/aiFitScore'

const TABS = [
  'overview',
  'pipeline',
  'ranking',
  'submissions',
  'interviews',
  'offers',
  'similar_jobs',
  'market',
  'timeline',
] as const

type Job360Tab = typeof TABS[number]

const TAB_LABELS: Record<Job360Tab, string> = {
  overview: 'Overview',
  pipeline: 'Pipeline',
  ranking: 'Ranking',
  submissions: 'Submissions',
  interviews: 'Interviews',
  offers: 'Offers',
  similar_jobs: 'Similar Jobs',
  market: 'Market',
  timeline: 'Timeline',
}

type RankedCandidate = {
  id: string
  candidate_name?: string
  ai_score?: number
  ai_fit_scores?: Partial<AiFitScores>
  pipeline_stage?: string
}

type Job360Data = {
  job?: {
    id: string
    title: string
    company?: string
    location?: string
    status?: string
    description?: string
    hiring_manager?: string
    hiring_difficulty?: string
  }
  pipeline?: Record<string, number>
  ranking?: RankedCandidate[]
  submissions?: unknown[]
  interviews?: unknown[]
  offers?: unknown[]
  similar_jobs?: unknown[]
  market?: { insights?: Record<string, unknown>; salary_benchmark?: Record<string, unknown> }
  timeline?: unknown[]
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-sm font-bold text-slate-400 text-center py-10">No {label.toLowerCase()} yet</p>
}

function EntityList({
  items,
  onOpenCandidate,
  labelKey = 'candidate_name',
}: {
  items?: unknown[]
  onOpenCandidate?: (id: string) => void
  labelKey?: string
}) {
  if (!items?.length) return <EmptyHint label="records" />
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const row = item as Record<string, unknown>
        const id = String(row.id ?? row.resume_id ?? '')
        const title = String(row[labelKey] ?? row.title ?? row.name ?? `Item ${i + 1}`)
        return (
          <li key={id || i} className="py-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-900">{title}</p>
              {row.status != null && <p className="text-xs font-medium text-slate-500">{String(row.status)}</p>}
            </div>
            {id && onOpenCandidate && (
              <button
                type="button"
                onClick={() => onOpenCandidate(id)}
                className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900"
              >
                View →
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function Job360View({
  jobId,
  onClose,
  onOpenCandidate,
  onNavigate,
}: {
  jobId: string
  onClose: () => void
  onOpenCandidate?: (id: string) => void
  onNavigate?: (tab: string) => void
}) {
  const [tab, setTab] = useState<Job360Tab>('overview')
  const [data, setData] = useState<Job360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/360`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        if (res.status === 404) {
          setData({ job: { id: jobId, title: 'Job' } })
          setError('360 view not available yet — showing shell')
        } else {
          setData({ job: { id: jobId, title: 'Job' } })
          setError(body.error || `Could not load job 360 (${res.status})`)
        }
        return
      }
      setData(await res.json())
    } catch {
      setData({ job: { id: jobId, title: 'Job' } })
      setError('Network error — limited view')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { load() }, [load])

  const job = data?.job
  const handleTab = (t: Job360Tab) => {
    setTab(t)
  }

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer-panel" style={{ maxWidth: 780 }}>
        <div className="drawer-header">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate page-title">{job?.title ?? 'Job 360°'}</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {[job?.company, job?.location, job?.status].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-x-0.5 bg-white px-1 sticky top-0 z-10">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTab(t)}
              className={`px-3 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
                tab === t ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              {error && (
                <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{error}</p>
              )}

              {tab === 'overview' && (
                <div className="space-y-4">
                  {job?.description && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1">Description</p>
                      <p className="text-sm font-medium text-slate-700 line-clamp-6">{job.description}</p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Hiring manager</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">{job?.hiring_manager || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Difficulty</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1 capitalize">{job?.hiring_difficulty || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'pipeline' && (
                <div>
                  {data?.pipeline && Object.keys(data.pipeline).length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(data.pipeline).map(([stage, count]) => (
                        <div key={stage} className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-xl font-extrabold text-indigo-700">{count}</p>
                          <p className="text-[10px] font-extrabold text-slate-500 capitalize mt-1">{stage.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint label="pipeline stages" />
                  )}
                </div>
              )}

              {tab === 'ranking' && (
                <div className="space-y-3">
                  {!data?.ranking?.length ? (
                    <EmptyHint label="ranked candidates" />
                  ) : (
                    data.ranking.map((c, i) => (
                      <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-400">#{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => onOpenCandidate?.(c.id)}
                              className="text-sm font-extrabold text-indigo-700 hover:underline"
                            >
                              {c.candidate_name ?? c.id.slice(0, 8)}
                            </button>
                          </div>
                          {c.ai_score != null && (
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {c.ai_score}%
                            </span>
                          )}
                        </div>
                        {c.ai_fit_scores?.overall != null && (
                          <AiFitScoreCard scores={c.ai_fit_scores as AiFitScores} compact />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'submissions' && <EntityList items={data?.submissions} onOpenCandidate={onOpenCandidate} />}
              {tab === 'interviews' && <EntityList items={data?.interviews} onOpenCandidate={onOpenCandidate} />}
              {tab === 'offers' && <EntityList items={data?.offers} onOpenCandidate={onOpenCandidate} />}
              {tab === 'similar_jobs' && <EntityList items={data?.similar_jobs} labelKey="title" />}
              {tab === 'market' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Market intelligence
                  </div>
                  {data?.market?.salary_benchmark && Object.keys(data.market.salary_benchmark).length > 0 ? (
                    <pre className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(data.market.salary_benchmark, null, 2)}
                    </pre>
                  ) : null}
                  {data?.market?.insights && Object.keys(data.market.insights).length > 0 ? (
                    <pre className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(data.market.insights, null, 2)}
                    </pre>
                  ) : (
                    <EmptyHint label="market data" />
                  )}
                </div>
              )}
              {tab === 'timeline' && <EntityList items={data?.timeline} labelKey="title" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
