'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Loader2, Plus } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { OpsListChrome } from '@/components/recruitment/OpsListChrome'
import { DocsUploadPanel } from '@/components/recruitment/DocsUploadPanel'
import { EntityIdLink } from '@/components/ui/EntityIdLink'
import {
  CHECKLIST_COUNTRIES,
  OFFER_STATUSES,
  getDocumentChecklist,
  normalizeOfferStatus,
  labelFor,
  type EmploymentType,
} from '@/lib/recruitmentOs'
import { presetToRange, type DatePreset } from '@/lib/datePresets'
import { formatExpYears, formatIsoDate } from '@/lib/opsList'
import { formatPhoneInternational } from '@/lib/phoneFormat'

type OfferRow = {
  id: string
  short_id?: string | null
  resume_id: string
  status: string
  offer_salary: string | null
  expected_joining: string | null
  candidate_name: string
  candidate_short_id: string
  candidate_email: string
  candidate_phone?: string | null
  lifecycle_status?: string | null
  years_experience?: string | null
  current_salary?: string | null
  expected_salary?: string | null
  submission_client?: string | null
  submission_position?: string | null
  job_title?: string | null
  job_client_name?: string | null
  hr_checklist: Record<string, boolean>
  doc_slots?: Record<string, boolean>
  docs_status?: string
  slots_filled?: number
  slots_total?: number
  employment_type?: string | null
  recruiter_name?: string | null
  interview_feedback_text?: string | null
  hr_discussion?: string
  budget_ok?: boolean
  offer_letter_status?: string
  joined_status?: string
  joined_date?: string | null
}

const DOCS_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'collecting', label: 'Collecting docs' },
  { value: 'with_hr', label: 'With HR' },
  { value: 'onboarding', label: 'OnBoarding (recruiter upload)' },
  { value: 'clearance_done', label: 'Clearance done' },
]

const HR_DISCUSSION_OPTIONS = [
  { value: 'pending', label: 'HR discussion pending' },
  { value: 'in_progress', label: 'HR discussion in progress' },
  { value: 'done', label: 'HR discussion done' },
  { value: 'not_required', label: 'Not required' },
]

const OFFER_LETTER_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'declined', label: 'Declined' },
]

const JOINED_STATUS_OPTIONS = [
  { value: 'not_joined', label: 'Not joined' },
  { value: 'joined', label: 'Joined' },
  { value: 'no_show', label: 'No show' },
  { value: 'dropped', label: 'Dropped' },
]

type SubView = 'docs' | 'hr'

export function SelectedPipelineTab({
  onOpenCandidate,
  isManager = false,
}: {
  onOpenCandidate?: (shortId: string) => void
  isManager?: boolean
}) {
  const [subView, setSubView] = useState<SubView>('docs')
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [docsFilter, setDocsFilter] = useState('')
  const [preset, setPreset] = useState<DatePreset | string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(!isManager)
  const [canToggleMine, setCanToggleMine] = useState(isManager)
  const [summaryAll, setSummaryAll] = useState(0)
  const [byStatus, setByStatus] = useState<Record<string, number>>({})
  const [docsCounts, setDocsCounts] = useState<Record<string, number>>({})
  const [country, setCountry] = useState('MY')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('local')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [candQ, setCandQ] = useState('')
  const [candOpts, setCandOpts] = useState<{ id: string; short_id: string; candidate_name: string }[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [docsOffer, setDocsOffer] = useState<OfferRow | null>(null)
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

  const buildParams = useCallback((forExport = false) => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (docsFilter) params.set('docs_status', docsFilter)
    if (search.trim()) params.set('q', search.trim())
    if (mine) params.set('mine', '1')
    else if (isManager) params.set('mine', '0')
    const range = dateFrom || dateTo ? { from: dateFrom, to: dateTo } : presetToRange(preset)
    if (range?.from) params.set('date_from', range.from)
    if (range?.to) params.set('date_to', range.to)
    if (forExport) params.set('format', 'csv')
    return params
  }, [statusFilter, docsFilter, search, mine, isManager, dateFrom, dateTo, preset])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/offers?${buildParams()}`)
      const data = await res.json()
      setOffers(data.offers ?? [])
      setSummaryAll(data.summary?.all ?? (data.offers?.length ?? 0))
      setByStatus(data.summary?.by_status ?? {})
      setDocsCounts(data.summary?.docs ?? {})
      if (typeof data.can_toggle_mine === 'boolean') setCanToggleMine(data.can_toggle_mine)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { load() }, [load])
  useEffect(() => { setMine(!isManager) }, [isManager])

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

  const exportWith = (format: 'csv' | 'xlsx') => {
    const p = buildParams(true)
    p.set('format', format)
    window.location.href = `/api/offers/export?${p}`
  }

  const clientOf = (o: OfferRow) => o.job_client_name || o.submission_client || '—'
  const positionOf = (o: OfferRow) => o.submission_position || o.job_title || '—'

  const pills = subView === 'docs'
    ? [
        { id: 'all', label: 'All', count: summaryAll },
        ...DOCS_STATUS_OPTIONS.map(d => ({
          id: d.value,
          label: d.label,
          count: docsCounts[d.value] ?? 0,
        })),
      ]
    : [
        { id: 'all', label: 'All', count: summaryAll },
        ...['selected', 'offer_draft', 'offer_released', 'offer_accepted', 'joined', 'dropped'].map(s => ({
          id: s,
          label: labelFor(OFFER_STATUSES, s),
          count: byStatus[s] ?? 0,
        })),
      ]

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Award className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Offer & Onboarding</h1>
            <p className="text-sm text-slate-500 mt-0.5">Selected & Docs · HR & Offer — clear Cand. / Offer IDs</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowCreate(s => !s)} className="btn-primary !py-2 !px-3 text-sm">
          <Plus className="w-4 h-4" /> New offer
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setSubView('docs'); setStatusFilter(''); setDocsFilter('') }}
          className={`px-4 py-2 rounded-xl text-sm font-extrabold border ${
            subView === 'docs' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Selected & Docs
        </button>
        <button
          type="button"
          onClick={() => { setSubView('hr'); setDocsFilter(''); setStatusFilter('') }}
          className={`px-4 py-2 rounded-xl text-sm font-extrabold border ${
            subView === 'hr' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          HR & Offer
        </button>
      </div>

      <OpsListChrome
        scopeMine={mine}
        showMineToggle={canToggleMine || isManager}
        onToggleMine={setMine}
        preset={preset}
        onPreset={v => { setPreset(v); setDateFrom(''); setDateTo('') }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={v => { setDateFrom(v); setPreset('') }}
        onDateTo={v => { setDateTo(v); setPreset('') }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, RES-, OFF-, phone…"
        pills={pills}
        activePill={subView === 'docs' ? (docsFilter || 'all') : (statusFilter || 'all')}
        onPill={id => {
          if (subView === 'docs') setDocsFilter(id === 'all' ? '' : id)
          else setStatusFilter(id === 'all' ? '' : id)
        }}
        onExportCsv={() => exportWith('csv')}
        onExportXlsx={() => exportWith('xlsx')}
        onRefresh={load}
      >
        {subView === 'docs' && (
          <div className="flex flex-wrap gap-3 items-end">
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
          </div>
        )}
      </OpsListChrome>

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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : subView === 'docs' ? (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th className="font-extrabold">Emp./Cand. ID</th>
                <th className="font-extrabold">Name</th>
                <th className="font-extrabold">Phone</th>
                <th className="font-extrabold">Email</th>
                <th className="font-extrabold">Client / Project</th>
                <th className="font-extrabold">Position</th>
                <th className="font-extrabold">Exp</th>
                <th className="font-extrabold">Current Sal.</th>
                <th className="font-extrabold">Expected Sal.</th>
                <th className="font-extrabold">Interview feedback</th>
                <th className="font-extrabold">Docs status</th>
                <th className="font-extrabold">Slots filled</th>
                <th className="font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-10 text-slate-400">No selected / docs cases</td></tr>
              ) : offers.map((o, i) => {
                const filled = typeof o.slots_filled === 'number' ? o.slots_filled : 0
                const requiredTotal = checklistItems.filter(i => i.required).length
                const total = typeof o.slots_total === 'number' && o.slots_total > 0
                  ? o.slots_total
                  : (requiredTotal > 0 ? requiredTotal : checklistItems.length || 5)
                const pct = total ? Math.min(100, Math.round((filled / total) * 100)) : 0
                const missingRequired = checklistItems.filter(i => i.required).map(i => i.label)
                return (
                  <tr key={o.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                    <td>
                      <EntityIdLink kind="candidate" id={o.candidate_short_id} onClick={() => onOpenCandidate?.(o.candidate_short_id)} />
                    </td>
                    <td>
                      <button type="button" className="text-left text-indigo-700 hover:underline font-bold text-sm"
                        onClick={() => onOpenCandidate?.(o.candidate_short_id)}>
                        {o.candidate_name}
                      </button>
                    </td>
                    <td className="text-xs whitespace-nowrap">{formatPhoneInternational(o.candidate_phone) || o.candidate_phone || '—'}</td>
                    <td className="text-xs max-w-[150px] truncate" title={o.candidate_email || ''}>{o.candidate_email || '—'}</td>
                    <td className="text-sm max-w-[180px] truncate" title={clientOf(o)}>{clientOf(o)}</td>
                    <td className="text-sm max-w-[140px] truncate">{positionOf(o)}</td>
                    <td className="text-xs">{formatExpYears(o.years_experience)}</td>
                    <td className="text-xs">{o.current_salary || '—'}</td>
                    <td className="text-xs">{o.expected_salary || o.offer_salary || '—'}</td>
                    <td className="text-xs max-w-[140px] truncate" title={o.interview_feedback_text || ''}>
                      {o.interview_feedback_text || '—'}
                    </td>
                    <td>
                      <select
                        value={o.docs_status ?? 'not_started'}
                        onChange={e => patchOffer(o.id, { docs_status: e.target.value })}
                        className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white appearance-none max-w-[160px]"
                      >
                        {DOCS_STATUS_OPTIONS.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </td>
                    <td title={missingRequired.length ? `Required for ${country}: ${missingRequired.join(', ')}` : `Checklist: ${country}`}>
                      <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{pct}% · {filled}/{total}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{country} checklist</p>
                    </td>
                    <td className="whitespace-nowrap space-x-2">
                      <button type="button" className="text-xs font-bold text-indigo-700 hover:underline"
                        onClick={() => setDocsOffer(o)}>
                        Docs
                      </button>
                      <button type="button" className="text-xs font-bold text-slate-600 hover:underline"
                        onClick={() => onOpenCandidate?.(o.candidate_short_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th className="font-extrabold">Open</th>
                <th className="font-extrabold">Emp / Cand. ID</th>
                <th className="font-extrabold">Name</th>
                <th className="font-extrabold">Phone</th>
                <th className="font-extrabold">Email</th>
                <th className="font-extrabold">Client (Full)</th>
                <th className="font-extrabold">Position</th>
                <th className="font-extrabold">Exp</th>
                <th className="font-extrabold">Current Sal.</th>
                <th className="font-extrabold">Expected Sal.</th>
                <th className="font-extrabold">DOJ</th>
                <th className="font-extrabold">HR discussion</th>
                <th className="font-extrabold">Budget OK</th>
                <th className="font-extrabold">Offer letter</th>
                <th className="font-extrabold">Joined status</th>
                <th className="font-extrabold">Joined date</th>
                <th className="font-extrabold">HR Ops</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-10 text-slate-400">No HR / offer cases</td></tr>
              ) : offers.map((o, i) => (
                <tr key={o.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                  <td>
                    <button
                      type="button"
                      className="text-xs font-bold text-indigo-700 hover:underline"
                      onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                      title={o.short_id || 'Open offer'}
                    >
                      Open
                    </button>
                    {o.short_id ? (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        <EntityIdLink kind="offer" id={o.short_id} onClick={() => setExpandedId(o.id)} />
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <EntityIdLink kind="candidate" id={o.candidate_short_id} onClick={() => onOpenCandidate?.(o.candidate_short_id)} />
                  </td>
                  <td>
                    <button type="button" className="text-left text-indigo-700 hover:underline font-bold text-sm"
                      onClick={() => onOpenCandidate?.(o.candidate_short_id)}>
                      {o.candidate_name}
                    </button>
                  </td>
                  <td className="text-xs whitespace-nowrap">{formatPhoneInternational(o.candidate_phone) || o.candidate_phone || '—'}</td>
                  <td className="text-xs max-w-[150px] truncate">{o.candidate_email || '—'}</td>
                  <td className="text-sm max-w-[180px] truncate" title={clientOf(o)}>{clientOf(o)}</td>
                  <td className="text-sm max-w-[140px] truncate">{positionOf(o)}</td>
                  <td className="text-xs">{formatExpYears(o.years_experience)}</td>
                  <td className="text-xs">{o.current_salary || '—'}</td>
                  <td>
                    <input
                      defaultValue={o.expected_salary ?? o.offer_salary ?? ''}
                      onBlur={e => {
                        if (e.target.value !== (o.offer_salary ?? '')) patchOffer(o.id, { offer_salary: e.target.value })
                      }}
                      className="text-xs w-24 px-2 py-1 rounded border border-slate-200"
                      placeholder="—"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      defaultValue={formatIsoDate(o.expected_joining) || ''}
                      onBlur={e => {
                        if (e.target.value !== (formatIsoDate(o.expected_joining) || '')) {
                          patchOffer(o.id, { expected_joining: e.target.value || null })
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border border-slate-200"
                    />
                  </td>
                  <td>
                    <select
                      value={o.hr_discussion ?? 'pending'}
                      onChange={e => patchOffer(o.id, { hr_discussion: e.target.value })}
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white max-w-[150px] appearance-none"
                    >
                      {HR_DISCUSSION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(o.budget_ok)}
                      onChange={e => patchOffer(o.id, { budget_ok: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600"
                    />
                  </td>
                  <td>
                    <select
                      value={o.offer_letter_status ?? 'not_started'}
                      onChange={e => patchOffer(o.id, { offer_letter_status: e.target.value })}
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white max-w-[120px] appearance-none"
                    >
                      {OFFER_LETTER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {o.candidate_email && (
                      <button
                        type="button"
                        className="mt-1 block text-[10px] font-bold text-indigo-600 hover:underline"
                        onClick={async () => {
                          const res = await fetch('/api/offers/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ offer_id: o.id }),
                          })
                          const data = await res.json().catch(() => ({}))
                          window.alert(res.ok ? `Offer email sent via ${data.sent_via}` : (data.error || 'Send failed'))
                        }}
                      >
                        Send email
                      </button>
                    )}
                  </td>
                  <td>
                    <select
                      value={o.joined_status ?? (o.status === 'joined' ? 'joined' : 'not_joined')}
                      onChange={e => patchOffer(o.id, { joined_status: e.target.value })}
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white max-w-[120px] appearance-none"
                    >
                      {JOINED_STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      defaultValue={formatIsoDate(o.joined_date) || ''}
                      onBlur={e => {
                        if (e.target.value !== (formatIsoDate(o.joined_date) || '')) {
                          patchOffer(o.id, { joined_date: e.target.value || null })
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border border-slate-200"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-xs font-bold text-indigo-700 hover:underline whitespace-nowrap"
                      onClick={() => onOpenCandidate?.(o.candidate_short_id)}
                    >
                      Create consultant
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {docsOffer && (
        <DocsUploadPanel
          resumeId={docsOffer.resume_id}
          candidateName={docsOffer.candidate_name}
          onClose={() => setDocsOffer(null)}
          onUploaded={load}
        />
      )}
    </div>
  )
}
