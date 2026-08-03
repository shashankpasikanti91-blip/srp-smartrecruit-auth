'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, DollarSign, Loader2, Pencil, Save, Sparkles, X } from 'lucide-react'

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

type ClientRow = {
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

type Client360Data = {
  client?: ClientRow
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
  ai_insights?: { summary?: string; items?: string[] } | string[]
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
        const title = String(row[labelKey] ?? row.file_name ?? row.title ?? row.name ?? `Item ${i + 1}`)
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

function normalizeInsights(raw: Client360Data['ai_insights']): { summary?: string; items: string[] } {
  if (!raw) return { items: [] }
  if (Array.isArray(raw)) return { items: raw.filter(Boolean).map(String) }
  return {
    summary: raw.summary,
    items: Array.isArray(raw.items) ? raw.items.map(String) : [],
  }
}

export function Client360View({
  clientId,
  onClose,
  onNavigate,
  onSaved,
}: {
  clientId: string
  onClose: () => void
  onNavigate?: (tab: string) => void
  onSaved?: (client: ClientRow) => void
}) {
  const [tab, setTab] = useState<Client360Tab>('overview')
  const [data, setData] = useState<Client360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({
    name: '',
    industry: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    hiring_manager: '',
    country_code: '',
    notes: '',
  })

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
      const c = json.client as ClientRow | undefined
      if (c) {
        setForm({
          name: c.name || '',
          industry: c.industry || '',
          contact_name: c.contact_name || '',
          contact_email: c.contact_email || '',
          contact_phone: c.contact_phone || '',
          hiring_manager: c.hiring_manager || '',
          country_code: c.country_code || '',
          notes: c.notes || '',
        })
      }
    } catch {
      setData({ client: { id: clientId, name: 'Client' } })
      setError('Network error — limited view')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  const client = data?.client
  const insights = normalizeInsights(data?.ai_insights)

  const handleTab = (t: Client360Tab) => {
    setTab(t)
    onNavigate?.(t)
  }

  const saveEdits = async () => {
    if (!form.name.trim()) {
      setSaveError('Client name is required')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clientId, ...form }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(json.error || `Update failed (${res.status})`)
        return
      }
      const updated = json.client as ClientRow
      setData(prev => ({ ...(prev || {}), client: updated }))
      setEditing(false)
      onSaved?.(updated)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
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
          <div className="flex items-center gap-1">
            {tab === 'overview' && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                title="Edit client"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
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
                  {editing ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Contact name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Contact email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Contact phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm" placeholder="Hiring manager" value={form.hiring_manager} onChange={e => setForm(f => ({ ...f, hiring_manager: e.target.value }))} />
                      <input className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" placeholder="Country code" value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} />
                      <textarea className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" rows={3} placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                      {saveError && <p className="sm:col-span-2 text-sm text-red-700 font-medium">{saveError}</p>}
                      <div className="sm:col-span-2 flex gap-2">
                        <button type="button" onClick={saveEdits} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                        <button type="button" disabled={saving} onClick={() => { setEditing(false); setSaveError('') }} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-extrabold uppercase text-slate-400">Contact</p>
                          <p className="text-sm font-extrabold text-slate-900 mt-1">{client?.contact_name || '—'}</p>
                          <p className="text-xs font-medium text-slate-500">{client?.contact_email || '—'}</p>
                          <p className="text-xs font-medium text-slate-500">{client?.contact_phone || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-extrabold uppercase text-slate-400">Hiring manager</p>
                          <p className="text-sm font-extrabold text-slate-900 mt-1">{client?.hiring_manager || '—'}</p>
                          <p className="text-xs font-medium text-slate-500 mt-2">Country: {client?.country_code || '—'}</p>
                        </div>
                      </div>
                      {client?.notes && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                          <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1">Notes</p>
                          <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                        </div>
                      )}
                    </>
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
              {tab === 'documents' && <ListPanel items={data?.documents} labelKey="file_name" />}
              {tab === 'contracts' && <ListPanel items={data?.contracts} labelKey="file_name" />}
              {tab === 'timeline' && <ListPanel items={data?.timeline} labelKey="title" />}
              {tab === 'ai_insights' && (
                <div>
                  {insights.summary ? (
                    <p className="text-sm font-semibold text-slate-700 mb-3">{insights.summary}</p>
                  ) : null}
                  {insights.items.length ? (
                    <ul className="space-y-2">
                      {insights.items.map((item, i) => (
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
