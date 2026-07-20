'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle, Download, Loader2, Plus, RefreshCw } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { exportCsv } from '@/lib/exportCsv'
import {
  CHECKLIST_COUNTRIES,
  OFFER_STATUSES,
  getDocumentChecklist,
  normalizeOfferStatus,
  type EmploymentType,
} from '@/lib/recruitmentOs'

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
  employment_type?: string | null
}

export function SelectedPipelineTab({ onOpenCandidate }: { onOpenCandidate?: (shortId: string) => void }) {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [country, setCountry] = useState('MY')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('local')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [candQ, setCandQ] = useState('')
  const [candOpts, setCandOpts] = useState<{ id: string; short_id: string; candidate_name: string }[]>([])
  const [newOffer, setNewOffer] = useState({
    resume_id: '',
    offer_salary: '',
    expected_joining: '',
    status: 'selected',
  })

  const checklistItems = useMemo(
    () => getDocumentChecklist(country, employmentType),
    [country, employmentType],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/offers?${params}`)
      const data = await res.json()
      setOffers(data.offers ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

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
          status: normalizeOfferStatus(newOffer.status),
          offer_salary: newOffer.offer_salary || undefined,
          expected_joining: newOffer.expected_joining || undefined,
          employment_type: employmentType,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setNewOffer({ resume_id: '', offer_salary: '', expected_joining: '', status: 'selected' })
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
    if (typeof body.status === 'string') body.status = normalizeOfferStatus(body.status)
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
            <h1 className="page-title text-lg sm:text-xl">Offer & Onboarding</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Selected → documents → offer → joining → probation — multi-country checklist
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setShowCreate(s => !s)} className="btn-primary !py-2 !px-3 text-sm">
            <Plus className="w-4 h-4" /> New offer
          </button>
          <button
            type="button"
            onClick={() => exportCsv(
              'offer-onboarding.csv',
              ['Candidate', 'ID', 'Status', 'Salary', 'Joining', 'Lifecycle'],
              offers.map(o => [o.candidate_name, o.candidate_short_id, o.status, o.offer_salary, o.expected_joining, o.lifecycle_status]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={load} className="btn-secondary !py-2 !px-3 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 mb-4 space-y-3 max-w-lg">
          <input value={candQ} onChange={e => setCandQ(e.target.value)} placeholder="Search candidate…"
            className="form-input w-full" />
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
            placeholder="Offer salary" className="form-input w-full" />
          <input type="date" value={newOffer.expected_joining} onChange={e => setNewOffer(o => ({ ...o, expected_joining: e.target.value }))}
            className="form-input w-full" />
          <select value={newOffer.status} onChange={e => setNewOffer(o => ({ ...o, status: e.target.value }))} className="form-input w-full appearance-none">
            {OFFER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="button" onClick={createOffer} disabled={creating || !newOffer.resume_id} className="btn-primary">
            {creating ? 'Creating…' : 'Create offer case'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="field-label">Offer stage</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input !w-auto !py-1.5 !text-sm appearance-none">
            <option value="">All stages</option>
            {OFFER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Checklist country</label>
          <select value={country} onChange={e => setCountry(e.target.value)} className="form-input !w-auto !py-1.5 !text-sm appearance-none">
            {CHECKLIST_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Employment type</label>
          <select value={employmentType} onChange={e => setEmploymentType(e.target.value as EmploymentType)} className="form-input !w-auto !py-1.5 !text-sm appearance-none">
            <option value="local">Local</option>
            <option value="foreign">Foreign worker</option>
          </select>
        </div>
        <p className="text-xs font-medium text-slate-500 self-center">
          {checklistItems.length} template docs for {country} / {employmentType}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Lifecycle</th>
                <th>Offer stage</th>
                <th>Salary</th>
                <th>Joining</th>
                <th>Document checklist</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No offer / onboarding cases yet</td></tr>
              ) : offers.map((o, i) => {
                const checklist = o.doc_slots ?? o.hr_checklist ?? {}
                const done = checklistItems.filter(s => checklist[s.key]).length
                return (
                  <tr key={o.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                    <td>
                      <button type="button" className="text-left text-indigo-700 hover:underline font-bold text-sm"
                        onClick={() => onOpenCandidate?.(o.candidate_short_id)}>
                        {o.candidate_name}
                      </button>
                      <p className="text-xs text-slate-500">{o.candidate_short_id}</p>
                    </td>
                    <td className="text-xs capitalize">{o.lifecycle_status?.replace(/_/g, ' ') || '—'}</td>
                    <td>
                      <select
                        value={normalizeOfferStatus(o.status)}
                        onChange={e => patchOffer(o.id, { status: e.target.value })}
                        className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white max-w-[180px] appearance-none"
                      >
                        {OFFER_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
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
                        if (e.target.value !== (o.expected_joining?.slice(0, 10) ?? '')) {
                          patchOffer(o.id, { expected_joining: e.target.value || null })
                        }
                      }} className="text-xs px-2 py-1 rounded border border-slate-200" />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {checklistItems.map(slot => (
                          <button
                            key={slot.key}
                            type="button"
                            title={slot.label}
                            onClick={() => {
                              const next = { ...checklist, [slot.key]: !checklist[slot.key] }
                              patchOffer(o.id, { hr_checklist: next })
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${checklist[slot.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {slot.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 mt-1 font-bold">
                        <CheckCircle className={`w-3.5 h-3.5 ${done === checklistItems.length ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {done}/{checklistItems.length}
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
