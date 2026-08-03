'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Loader2, Plus, X } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { OpsListChrome } from '@/components/recruitment/OpsListChrome'
import { EntityIdLink } from '@/components/ui/EntityIdLink'
import { INTERVIEW_STATUSES, labelFor } from '@/lib/recruitmentOs'
import { presetToRange, type DatePreset } from '@/lib/datePresets'
import { formatExpYears, formatIsoDate, formatIsoTime } from '@/lib/opsList'

type Interview = {
  id: string
  short_id: string
  resume_id: string
  candidate_name: string
  candidate_email: string
  candidate_short_id?: string | null
  candidate_phone?: string | null
  job_title: string | null
  job_client_name?: string | null
  scheduled_at: string
  duration_minutes: number
  format: string | null
  status: string
  meet_link: string | null
  interviewer_name: string | null
  round?: number
  rating?: number | null
  feedback?: string | null
  years_experience?: string | null
  current_salary?: string | null
  expected_salary?: string | null
}

type CandPick = { id: string; short_id: string; candidate_name: string; candidate_email: string }

const STATUS_PILLS = [
  { id: '', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'awaiting_feedback', label: 'Awaiting feedback' },
  { id: 'completed', label: 'Completed' },
  { id: 'selected', label: 'Selected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no_show', label: 'No show' },
]

export function InterviewsTab({
  onOpenCandidate,
  isManager = false,
}: {
  onOpenCandidate?: (idOrShortId: string) => void
  isManager?: boolean
}) {
  const [rows, setRows] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [preset, setPreset] = useState<DatePreset | string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(!isManager)
  const [canToggleMine, setCanToggleMine] = useState(isManager)
  const [summaryAll, setSummaryAll] = useState(0)
  const [byStatus, setByStatus] = useState<Record<string, number>>({})
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [candQ, setCandQ] = useState('')
  const [candOpts, setCandOpts] = useState<CandPick[]>([])
  const [form, setForm] = useState({
    resume_id: '',
    candidate_name: '',
    candidate_email: '',
    scheduled_at: '',
    duration_minutes: '60',
    format: 'video' as 'video' | 'phone' | 'in_person',
    notes: '',
    round: '1',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState('3')

  const buildParams = useCallback((forExport = false) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (search.trim()) params.set('q', search.trim())
    if (mine) params.set('mine', '1')
    else if (isManager) params.set('mine', '0')
    const range = dateFrom || dateTo ? { from: dateFrom, to: dateTo } : presetToRange(preset)
    if (range?.from) params.set('date_from', range.from)
    if (range?.to) params.set('date_to', range.to)
    if (!forExport) params.set('limit', '100')
    return params
  }, [status, search, mine, isManager, dateFrom, dateTo, preset])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/interviews?${buildParams()}`)
      const data = await res.json()
      setRows(data.interviews ?? [])
      setSummaryAll(data.summary?.all ?? data.total ?? 0)
      setByStatus(data.summary?.by_status ?? {})
      if (typeof data.can_toggle_mine === 'boolean') setCanToggleMine(data.can_toggle_mine)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { load() }, [load])
  useEffect(() => { setMine(!isManager) }, [isManager])

  useEffect(() => {
    if (!showSchedule || candQ.length < 2) { setCandOpts([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/candidates?q=${encodeURIComponent(candQ)}&limit=10`)
      const data = await res.json()
      setCandOpts((data.candidates ?? []).map((c: CandPick) => ({
        id: c.id, short_id: c.short_id, candidate_name: c.candidate_name, candidate_email: c.candidate_email,
      })))
    }, 300)
    return () => clearTimeout(t)
  }, [candQ, showSchedule])

  const schedule = async () => {
    if (!form.resume_id || !form.scheduled_at) return
    setScheduling(true)
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: form.resume_id,
          candidate_name: form.candidate_name,
          candidate_email: form.candidate_email,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_minutes: parseInt(form.duration_minutes, 10) || 60,
          format: form.format,
          notes: form.notes || undefined,
          round: Number(form.round) || 1,
        }),
      })
      if (res.ok) {
        setShowSchedule(false)
        setForm({ resume_id: '', candidate_name: '', candidate_email: '', scheduled_at: '', duration_minutes: '60', format: 'video', notes: '', round: '1' })
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Schedule failed')
      }
    } finally {
      setScheduling(false)
    }
  }

  const patchInterview = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  const cancelInterview = async (id: string) => {
    if (!confirm('Cancel this interview?')) return
    await fetch(`/api/interviews/${id}`, { method: 'DELETE' })
    load()
  }

  const openEdit = (iv: Interview) => {
    setEditId(iv.id)
    setFeedback(typeof iv.feedback === 'string' ? iv.feedback : '')
    setRating(String(iv.rating ?? 3))
  }

  const exportWith = (format: 'csv' | 'xlsx') => {
    const p = buildParams(true)
    p.set('format', format)
    window.location.href = `/api/interviews/export?${p}`
  }

  const pills = STATUS_PILLS.map(p => ({
    id: p.id || 'all',
    label: p.label,
    count: p.id ? (byStatus[p.id] ?? 0) : summaryAll,
  }))

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Calendar className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Interview Scheduling</h1>
            <p className="text-sm text-slate-500 mt-0.5">{summaryAll} interviews in scope · Cand. ID + Interview ID</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowSchedule(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
          <Plus className="w-4 h-4" /> Schedule
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
        searchPlaceholder="Search name, RES-, INT-, phone…"
        pills={pills}
        activePill={status || 'all'}
        onPill={id => setStatus(id === 'all' ? '' : id)}
        onExportCsv={() => exportWith('csv')}
        onExportXlsx={() => exportWith('xlsx')}
        onRefresh={load}
      />

      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Schedule interview</h2>
              <button type="button" onClick={() => setShowSchedule(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <input value={candQ} onChange={e => setCandQ(e.target.value)} placeholder="Search candidate name or RES-ID…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            {candOpts.length > 0 && (
              <ul className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg divide-y">
                {candOpts.map(c => (
                  <li key={c.id}>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                      onClick={() => {
                        setForm(f => ({ ...f, resume_id: c.id, candidate_name: c.candidate_name, candidate_email: c.candidate_email }))
                        setCandQ(`${c.candidate_name} (${c.short_id})`)
                        setCandOpts([])
                      }}>
                      {c.candidate_name} · {c.short_id}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value as typeof form.format }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm appearance-none">
              <option value="video">Virtual</option>
              <option value="phone">Phone</option>
              <option value="in_person">Face-to-Face</option>
            </select>
            <select value={form.round} onChange={e => setForm(f => ({ ...f, round: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm appearance-none">
              {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>Round {r}</option>)}
            </select>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <button type="button" onClick={schedule} disabled={scheduling || !form.resume_id || !form.scheduled_at}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
              {scheduling ? 'Scheduling…' : 'Create interview'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th className="font-extrabold">Cand. ID</th>
                <th className="font-extrabold">1st Date</th>
                <th className="font-extrabold">1st Time</th>
                <th className="font-extrabold">2nd Date</th>
                <th className="font-extrabold">2nd Time</th>
                <th className="font-extrabold">Name</th>
                <th className="font-extrabold">Phone</th>
                <th className="font-extrabold">Email</th>
                <th className="font-extrabold">Client / Project</th>
                <th className="font-extrabold">Position</th>
                <th className="font-extrabold">Exp.</th>
                <th className="font-extrabold">Current Sal.</th>
                <th className="font-extrabold">Expected Sal.</th>
                <th className="font-extrabold">Feedback</th>
                <th className="font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-10 text-slate-400">No interviews in this filter</td></tr>
              ) : rows.map((iv, i) => {
                const round = Number(iv.round ?? 1)
                const d = formatIsoDate(iv.scheduled_at) || '—'
                const t = formatIsoTime(iv.scheduled_at) || '—'
                const firstDate = round <= 1 ? d : '—'
                const firstTime = round <= 1 ? t : '—'
                const secondDate = round >= 2 ? d : '—'
                const secondTime = round >= 2 ? t : '—'
                const fbText = typeof iv.feedback === 'string' && iv.feedback
                  ? iv.feedback
                  : labelFor(INTERVIEW_STATUSES, iv.status)
                return (
                  <tr key={iv.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                    <td>
                      <EntityIdLink
                        kind="candidate"
                        id={iv.candidate_short_id}
                        onClick={iv.resume_id || iv.candidate_short_id ? () => onOpenCandidate?.(iv.resume_id || iv.candidate_short_id!) : undefined}
                      />
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        <EntityIdLink kind="interview" id={iv.short_id} onClick={() => openEdit(iv)} />
                      </p>
                    </td>
                    <td className="text-xs whitespace-nowrap">{firstDate}</td>
                    <td className="text-xs whitespace-nowrap">{firstTime}</td>
                    <td className="text-xs whitespace-nowrap">{secondDate}</td>
                    <td className="text-xs whitespace-nowrap">{secondTime}</td>
                    <td>
                      <button
                        type="button"
                        className="text-left font-bold text-sm text-indigo-700 hover:underline"
                        onClick={() => (iv.resume_id || iv.candidate_short_id) && onOpenCandidate?.(iv.resume_id || iv.candidate_short_id!)}
                      >
                        {iv.candidate_name}
                      </button>
                    </td>
                    <td className="text-xs whitespace-nowrap">{iv.candidate_phone || '—'}</td>
                    <td className="text-xs max-w-[160px] truncate" title={iv.candidate_email || ''}>{iv.candidate_email || '—'}</td>
                    <td className="text-sm max-w-[180px] truncate" title={iv.job_client_name || ''}>{iv.job_client_name || '—'}</td>
                    <td className="text-sm max-w-[140px] truncate">{iv.job_title || '—'}</td>
                    <td className="text-xs">{formatExpYears(iv.years_experience)}</td>
                    <td className="text-xs">{iv.current_salary || '—'}</td>
                    <td className="text-xs">{iv.expected_salary || '—'}</td>
                    <td>
                      <select
                        value={iv.status}
                        onChange={e => patchInterview(iv.id, { status: e.target.value })}
                        className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white appearance-none max-w-[130px] mb-1 block"
                      >
                        {INTERVIEW_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 truncate max-w-[140px]" title={fbText}>{fbText}</p>
                    </td>
                    <td className="space-x-1 whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(iv)} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                      {iv.status !== 'cancelled' && (
                        <button type="button" onClick={() => cancelInterview(iv.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900">Interview edit / feedback</h2>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Notes for the hiring team…" />
            <select value={rating} onChange={e => setRating(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm appearance-none">
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Rating {n}/5</option>)}
            </select>
            <button type="button" onClick={async () => {
              await patchInterview(editId, { feedback, rating: Number(rating), status: 'completed' })
              setEditId(null)
            }} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Save feedback</button>
          </div>
        </div>
      )}
    </div>
  )
}
