'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, DollarSign, Loader2, Sparkles, X } from 'lucide-react'

const TABS = [
  'overview',
  'requirements',
  'jobs',
  'placements',
  'revenue',
  'recruiters',
  'communications',
  'meetings',
  'documents',
  'contracts',
  'timeline',
  'ai_insights',
] as const

type Client360Tab = typeof TABS[number]

const TAB_LABELS: Record<Client360Tab, string> = {
  overview: 'Overview',
  requirements: 'Requirements',
  jobs: 'Jobs',
  placements: 'Placements',
  revenue: 'Revenue',
  recruiters: 'Recruiters',
  communications: 'Communications',
  meetings: 'Meetings',
  documents: 'Documents',
  contracts: 'Contracts',
  timeline: 'Timeline',
  ai_insights: 'AI Insights',
}

type Client360Data = {
  client?: {
    id: string
    name: string
    industry?: string | null
    contact_name?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    hiring_manager?: string | null
    revenue_ytd?: number | null
    country_code?: string | null
    notes?: string | null
  }
  requirements?: unknown[]
  jobs?: unknown[]
  placements?: unknown[]
  revenue?: { ytd?: number; history?: unknown[] }
  recruiters?: unknown[]
  communications?: unknown[]
  meetings?: unknown[]
  documents?: unknown[]
  contracts?: unknown[]
  timeline?: unknown[]
  ai_insights?: { summary?: string; items?: string[] }
}

function EmptyHint({ label }: { label: string }) {
  return (
    <p className="text-sm font-bold text-slate-400 text-center py-10">
      No {label.toLowerCase()} data yet
    </p>
  )
}

function ListPanel({ items, labelKey = 'title' }: { items?: unknown[]; labelKey?: string }) {
  if (!items?.length) return <EmptyHint label="records" />
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const row = item as Record<string, unknown>
        const title = String(row[labelKey] ?? row.name ?? row.title ?? `Item ${i + 1}`)
        const sub = row.status ?? row.scheduled_at ?? row.created_at
        return (
          <li key={String(row.id ?? i)} className="py-3">
            <p className="text-sm font-extrabold text-slate-900">{title}</p>
            {sub != null && <p className="text-xs font-medium text-slate-500 mt-0.5">{String(sub)}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export function Client360View({
  clientId,
  onClose,
  onNavigate,
}: {
  clientId: string
  onClose: () => void
  onNavigate?: (tab: string) => void
}) {
  const [tab, setTab] = useState<Client360Tab>('overview')
  const [data, setData] = useState<Client360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/360`)
      if (!res.ok) {
        if (res.status === 404) {
          setData({ client: { id: clientId, name: 'Client' } })
          setError('360 view not available yet — showing shell')
        } else {
          setData(null)
          setError('Could not load client 360')
        }
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData({ client: { id: clientId, name: 'Client' } })
      setError('Network error — limited view')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  const client = data?.client
  const handleTab = (t: Client360Tab) => {
    setTab(t)
    onNavigate?.(t)
  }

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer-panel" style={{ maxWidth: 800 }}>
        <div className="drawer-header">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate page-title">
                {client?.name ?? 'Client 360°'}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {[client?.industry, client?.country_code].filter(Boolean).join(' · ') || 'Enterprise client view'}
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
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Contact</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">{client?.contact_name || '—'}</p>
                      <p className="text-xs font-medium text-slate-500">{client?.contact_email}</p>
                      <p className="text-xs font-medium text-slate-500">{client?.contact_phone}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Hiring manager</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">{client?.hiring_manager || '—'}</p>
                    </div>
                  </div>
                  {client?.notes && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1">Notes</p>
                      <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'requirements' && <ListPanel items={data?.requirements} labelKey="title" />}
              {tab === 'jobs' && <ListPanel items={data?.jobs} labelKey="title" />}
              {tab === 'placements' && <ListPanel items={data?.placements} labelKey="candidate_name" />}
              {tab === 'revenue' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <p className="text-2xl font-extrabold text-slate-900">
                      {data?.revenue?.ytd ?? client?.revenue_ytd ?? '—'}
                    </p>
                    <span className="text-xs font-bold text-slate-400">YTD</span>
                  </div>
                  <ListPanel items={data?.revenue?.history as unknown[]} />
                </div>
              )}
              {tab === 'recruiters' && <ListPanel items={data?.recruiters} labelKey="name" />}
              {tab === 'communications' && <ListPanel items={data?.communications} />}
              {tab === 'meetings' && <ListPanel items={data?.meetings} labelKey="title" />}
              {tab === 'documents' && <ListPanel items={data?.documents} labelKey="name" />}
              {tab === 'contracts' && <ListPanel items={data?.contracts} labelKey="name" />}
              {tab === 'timeline' && <ListPanel items={data?.timeline} labelKey="title" />}
              {tab === 'ai_insights' && (
                <div>
                  {data?.ai_insights?.summary ? (
                    <p className="text-sm font-semibold text-slate-700 mb-3">{data.ai_insights.summary}</p>
                  ) : null}
                  {data?.ai_insights?.items?.length ? (
                    <ul className="space-y-2">
                      {data.ai_insights.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm font-semibold text-slate-700">
                          <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyHint label="AI insights" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
