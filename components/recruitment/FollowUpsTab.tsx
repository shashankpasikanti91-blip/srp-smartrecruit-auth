'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Download, Loader2, Plus, RefreshCw } from 'lucide-react'
import { exportCsv } from '@/lib/exportCsv'
import { EntityNotesTimeline } from '@/components/ui/EntityNotesTimeline'

type FollowUp = {
  id: string
  title: string
  channel: string
  due_at: string
  status: string
  notes: string | null
  candidate_name: string | null
  candidate_short_id: string | null
}

const BUCKETS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'done', label: 'Done' },
] as const

export function FollowUpsTab() {
  const [bucket, setBucket] = useState<string>('overdue')
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', channel: 'call', due_at: '', notes: '', candidate_q: '', resume_id: '' })
  const [notesForId, setNotesForId] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    const res = await fetch('/api/follow-ups?counts=1&mine=1')
    const data = await res.json()
    if (data.counts) setCounts(data.counts)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/follow-ups?bucket=${bucket}&mine=1`)
      const data = await res.json()
      setRows(data.follow_ups ?? [])
    } finally {
      setLoading(false)
    }
  }, [bucket])

  useEffect(() => { load(); loadCounts() }, [load, loadCounts])

  const markDone = async (id: string) => {
    await fetch(`/api/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    load()
    loadCounts()
  }

  const createFollowUp = async () => {
    if (!form.title.trim() || !form.due_at) return
    setCreating(true)
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          channel: form.channel,
          due_at: new Date(form.due_at).toISOString(),
          notes: form.notes || undefined,
          resume_id: form.resume_id || undefined,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setForm({ title: '', channel: 'call', due_at: '', notes: '', candidate_q: '', resume_id: '' })
        setBucket('today')
        load()
        loadCounts()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Create failed')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Bell className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Follow-ups</h1>
            <p className="text-sm text-slate-500 mt-0.5">Your pending candidate touchpoints</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
            <Plus className="w-4 h-4" /> New follow-up
          </button>
          <button
            type="button"
            onClick={() => exportCsv(
              `follow-ups-${bucket}.csv`,
              ['Title', 'Candidate', 'Candidate ID', 'Channel', 'Due', 'Status', 'Notes'],
              rows.map(r => [r.title, r.candidate_name, r.candidate_short_id, r.channel, r.due_at, r.status, r.notes]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={() => { load(); loadCounts() }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 mb-4 space-y-3 max-w-lg">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Follow-up title *" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          <div className="flex gap-2">
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <input type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          <button type="button" onClick={createFollowUp} disabled={creating || !form.title.trim() || !form.due_at}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
            {creating ? 'Creating…' : 'Create follow-up'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {BUCKETS.map(b => (
          <button key={b.key} type="button" onClick={() => setBucket(b.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${bucket === b.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {b.label}
            {counts[b.key] != null && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${bucket === b.key ? 'bg-indigo-500' : 'bg-slate-100'}`}>
                {counts[b.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center py-12 text-slate-400">No follow-ups in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(f => (
            <li key={f.id} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{f.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{f.channel} · Due {new Date(f.due_at).toLocaleString()}</p>
                  {f.candidate_name && <p className="text-xs text-indigo-700 mt-1">{f.candidate_name} ({f.candidate_short_id})</p>}
                  {f.notes && <p className="text-sm text-slate-600 mt-2">{f.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setNotesForId(notesForId === f.id ? null : f.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100">
                    Notes
                  </button>
                  {f.status === 'pending' && (
                    <button type="button" onClick={() => markDone(f.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
                      <Check className="w-3.5 h-3.5" /> Done
                    </button>
                  )}
                </div>
              </div>
              {notesForId === f.id && (
                <div className="mt-3">
                  <EntityNotesTimeline
                    entityType="follow_up"
                    entityId={f.id}
                    title="Follow-up notes"
                    defaultCategory="follow_up"
                    allowedCategories={['follow_up', 'recruiter', 'internal', 'general']}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
