'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, CheckCircle, Loader2, Plus, RefreshCw } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'

type OfferRow = {
  id: string
  resume_id: string
  status: string
  offer_salary: string | null
  expected_joining: string | null
  candidate_name: string
  candidate_short_id: string
  candidate_email: string
  lifecycle_status?: string | null
  hr_checklist: Record<string, boolean>
  doc_slots?: Record<string, boolean>
}

const DOC_SLOTS = ['resume', 'passport', 'visa', 'certificate', 'offer_letter']

export function SelectedPipelineTab({ onOpenCandidate }: { onOpenCandidate?: (shortId: string) => void }) {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lifecycleFilter, setLifecycleFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [candQ, setCandQ] = useState('')
  const [candOpts, setCandOpts] = useState<{ id: string; short_id: string; candidate_name: string }[]>([])
  const [newOffer, setNewOffer] = useState({ resume_id: '', offer_salary: '', expected_joining: '', status: 'offer_released' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (lifecycleFilter) params.set('lifecycle', lifecycleFilter)
      const res = await fetch(`/api/offers?${params}`)
      const data = await res.json()
      setOffers(data.offers ?? [])
    } finally {
      setLoading(false)
    }
  }, [lifecycleFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!showCreate || candQ.length < 2) { setCandOpts([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/candidates?q=${encodeURIComponent(candQ)}&limit=10`)
      const data = await res.json()
      setCandOpts((data.candidates ?? []).map((c: { id: string; short_id: string; candidate_name: string }) => ({
        id: c.id, short_id: c.short_id, candidate_name: c.candidate_name,
      })))
    }, 300)
    return () => clearTimeout(t)
  }, [candQ, showCreate])

  const createOffer = async () => {
    if (!newOffer.resume_id) return
    setCreating(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: newOffer.resume_id,
          status: newOffer.status,
          offer_salary: newOffer.offer_salary || undefined,
          expected_joining: newOffer.expected_joining || undefined,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setNewOffer({ resume_id: '', offer_salary: '', expected_joining: '', status: 'offer_released' })
        setCandQ('')
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Create failed')
      }
    } finally {
      setCreating(false)
    }
  }

  const patchOffer = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/offers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Award className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Selected & Offers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Offer pipeline with live HR document checklist</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
            <Plus className="w-4 h-4" /> New offer
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 mb-4 space-y-3 max-w-lg">
          <input value={candQ} onChange={e => setCandQ(e.target.value)} placeholder="Search candidate…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          {candOpts.length > 0 && (
            <ul className="border border-slate-100 rounded-lg divide-y bg-white max-h-32 overflow-y-auto">
              {candOpts.map(c => (
                <li key={c.id}>
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                    onClick={() => { setNewOffer(o => ({ ...o, resume_id: c.id })); setCandQ(`${c.candidate_name} (${c.short_id})`); setCandOpts([]) }}>
                    {c.candidate_name} · {c.short_id}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input value={newOffer.offer_salary} onChange={e => setNewOffer(o => ({ ...o, offer_salary: e.target.value }))}
            placeholder="Offer salary" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          <input type="date" value={newOffer.expected_joining} onChange={e => setNewOffer(o => ({ ...o, expected_joining: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white" />
          <button type="button" onClick={createOffer} disabled={creating || !newOffer.resume_id}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
            {creating ? 'Creating…' : 'Create offer case'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap gap-3">
        <select value={lifecycleFilter} onChange={e => setLifecycleFilter(e.target.value)}
          className="text-sm rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">All lifecycle</option>
          <option value="selected">Selected</option>
          <option value="offer">Offer stages</option>
          <option value="joined">Joined</option>
        </select>
        <p className="text-xs text-slate-500 self-center">Checklist from live document slots: {DOC_SLOTS.join(', ')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>Candidate</th><th>Lifecycle</th><th>Status</th><th>Salary</th><th>Joining</th><th>HR Checklist</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No active offer cases</td></tr>
              ) : offers.map((o, i) => {
                const checklist = o.doc_slots ?? o.hr_checklist ?? {}
                const done = DOC_SLOTS.filter(s => checklist[s]).length
                return (
                  <tr key={o.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                    <td>
                      <button type="button" className="text-left text-indigo-700 hover:underline font-medium text-sm"
                        onClick={() => onOpenCandidate?.(o.candidate_short_id)}>
                        {o.candidate_name}
                      </button>
                      <p className="text-xs text-slate-500">{o.candidate_short_id}</p>
                    </td>
                    <td className="text-xs capitalize">{o.lifecycle_status?.replace(/_/g, ' ') || '—'}</td>
                    <td>
                      <select value={o.status} onChange={e => patchOffer(o.id, { status: e.target.value })}
                        className="text-xs capitalize rounded-lg border border-slate-200 px-2 py-1 bg-white max-w-[140px]">
                        {['offer_released','negotiation','accepted','declined','joined','withdrawn'].map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input defaultValue={o.offer_salary ?? ''} onBlur={e => {
                        if (e.target.value !== (o.offer_salary ?? '')) patchOffer(o.id, { offer_salary: e.target.value })
                      }} className="text-xs w-24 px-2 py-1 rounded border border-slate-200" placeholder="—" />
                    </td>
                    <td className="text-xs">
                      <input type="date" defaultValue={o.expected_joining?.slice(0, 10) ?? ''} onBlur={e => {
                        if (e.target.value !== (o.expected_joining?.slice(0, 10) ?? '')) patchOffer(o.id, { expected_joining: e.target.value || null })
                      }} className="text-xs px-2 py-1 rounded border border-slate-200" />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {DOC_SLOTS.map(slot => (
                          <span key={slot} title={slot}
                            className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${checklist[slot] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {slot.split('_')[0]}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 mt-1">
                        <CheckCircle className={`w-3.5 h-3.5 ${done === DOC_SLOTS.length ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {done}/{DOC_SLOTS.length}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}
    </div>
  )
}
