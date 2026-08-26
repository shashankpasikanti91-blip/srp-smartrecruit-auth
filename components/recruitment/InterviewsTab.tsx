'use client'

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { Calendar, Loader2, Plus, X } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { OpsListChrome } from '@/components/recruitment/OpsListChrome'
import { EntityIdLink } from '@/components/ui/EntityIdLink'
import { INTERVIEW_STATUSES } from '@/lib/recruitmentOs'
import { presetToRange, type DatePreset } from '@/lib/datePresets'
import { formatExpYears } from '@/lib/opsList'
import { formatPhoneInternational } from '@/lib/phoneFormat'

type Interview = {
  id: string
  short_id: string
  resume_id: string
  job_post_id?: string | null
  candidate_name: string
  candidate_email: string
  candidate_short_id?: string | null
  candidate_phone?: string | null
  job_title: string | null
  job_client_name?: string | null
  scheduled_at: string | null
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

type GroupedRow = {
  key: string
  resume_id: string
  job_post_id: string | null
  candidate_name: string
  candidate_email: string
  candidate_short_id?: string | null
  candidate_phone?: string | null
  job_title: string | null
  job_client_name?: string | null
  years_experience?: string | null
  current_salary?: string | null
  expected_salary?: string | null
  primary: Interview
  byRound: Map<number, Interview>
  maxRound: number
}

const STATUS_PILLS = [
  { id: '', label: 'All' },
  { id: 'to_schedule', label: 'To schedule' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'awaiting_feedback', label: 'Awaiting feedback' },
  { id: 'completed', label: 'Completed' },
  { id: 'selected', label: 'Selected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no_show', label: 'No show' },
]

const CLOSED = new Set(['cancelled', 'rejected', 'no_show', 'interviewer_no_show'])

function ordinal(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function splitLocal(iso?: string | null): { date: string; time: string } {
  const local = toLocalInput(iso)
  return { date: local.slice(0, 10), time: local.slice(11, 16) }
}

function SlotPair({
  round,
  interview,
  onCommit,
  testId,
}: {
  round: number
  interview?: Interview
  onCommit: (round: number, localValue: string | null, existing?: Interview) => void
  testId?: string
}) {
  const initial = splitLocal(interview?.scheduled_at)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)

  const commit = () => {
    const prev = splitLocal(interview?.scheduled_at)
    if (!date && !time) {
      if (interview && (prev.date || prev.time)) onCommit(round, null, interview)
      return
    }
    if (!date || !time) return
    const local = `${date}T${time}`
    if (local === `${prev.date}T${prev.time}`) return
    onCommit(round, local, interview)
  }

  return (
    <>
      <td className="col-date" onClick={e => e.stopPropagation()}>
        <input
          type="date"
          data-testid={testId ? `${testId}-date` : undefined}
          value={date}
          onChange={e => setDate(e.target.value)}
          onBlur={commit}
          className="w-[8.5rem] text-xs px-1.5 py-1 rounded border border-slate-200 bg-white"
          aria-label={`${ordinal(round)} date`}
        />
      </td>
      <td className="col-date" onClick={e => e.stopPropagation()}>
        <input
          type="time"
          data-testid={testId ? `${testId}-time` : undefined}
          value={time}
          onChange={e => setTime(e.target.value)}
          onBlur={commit}
          className="w-[6.5rem] text-xs px-1.5 py-1 rounded border border-slate-200 bg-white"
          aria-label={`${ordinal(round)} time`}
        />
      </td>
    </>
  )
}

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
    duration_minutes: '60',
    format: 'video' as 'video' | 'phone' | 'in_person',
    notes: '',
    slots: ['', '', '', ''] as string[],
  })
  const [extraCols, setExtraCols] = useState(0)
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
    if (!forExport) params.set('limit', '200')
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

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedRow>()
    for (const iv of rows) {
      if (CLOSED.has(String(iv.status || '').toLowerCase())) continue
      const key = `${iv.resume_id || iv.candidate_short_id || iv.id}::${iv.job_post_id || ''}`
      const round = Math.max(1, Number(iv.round ?? 1) || 1)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          resume_id: iv.resume_id,
          job_post_id: iv.job_post_id ?? null,
          candidate_name: iv.candidate_name,
          candidate_email: iv.candidate_email,
          candidate_short_id: iv.candidate_short_id,
          candidate_phone: iv.candidate_phone,
          job_title: iv.job_title,
          job_client_name: iv.job_client_name,
          years_experience: iv.years_experience,
          current_salary: iv.current_salary,
          expected_salary: iv.expected_salary,
          primary: iv,
          byRound: new Map([[round, iv]]),
          maxRound: round,
        })
      } else {
        if (!existing.byRound.has(round) || Number(existing.byRound.get(round)!.round ?? 1) > round) {
          existing.byRound.set(round, iv)
        }
        if (round < Number(existing.primary.round ?? 1)) existing.primary = iv
        existing.maxRound = Math.max(existing.maxRound, round)
      }
    }
    return Array.from(map.values())
  }, [rows])

  const slotCount = Math.max(4, ...grouped.map(g => g.maxRound), 4 + extraCols)

  const postSlot = async (args: {
    resume_id: string
    candidate_name: string
    candidate_email?: string
    job_post_id?: string | null
    round: number
    scheduled_at?: string | null
    format?: string
    notes?: string
  }) => {
    const body: Record<string, unknown> = {
      resume_id: args.resume_id,
      candidate_name: args.candidate_name,
      candidate_email: args.candidate_email || undefined,
      job_post_id: args.job_post_id || undefined,
      round: args.round,
      duration_minutes: parseInt(form.duration_minutes, 10) || 60,
      format: args.format || form.format,
      notes: args.notes || undefined,
      send_invite: false,
      create_calendar: false,
    }
    if (args.scheduled_at) body.scheduled_at = new Date(args.scheduled_at).toISOString()
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Schedule failed')
    }
  }

  const schedule = async () => {
    if (!form.resume_id) return
    setScheduling(true)
    try {
      const filled = form.slots
        .map((s, i) => ({ round: i + 1, at: s.trim() }))
        .filter(s => s.at)
      if (filled.length === 0) {
        await postSlot({
          resume_id: form.resume_id,
          candidate_name: form.candidate_name,
          candidate_email: form.candidate_email,
          round: 1,
        })
      } else {
        for (const s of filled) {
          await postSlot({
            resume_id: form.resume_id,
            candidate_name: form.candidate_name,
            candidate_email: form.candidate_email,
            round: s.round,
            scheduled_at: s.at,
          })
        }
      }
      setShowSchedule(false)
      setForm({
        resume_id: '', candidate_name: '', candidate_email: '',
        duration_minutes: '60', format: 'video', notes: '', slots: ['', '', '', ''],
      })
      setCandQ('')
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Schedule failed')
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

  const commitSlot = async (group: GroupedRow, round: number, localValue: string | null, existing?: Interview) => {
    try {
      if (existing) {
        await patchInterview(existing.id, localValue
          ? { scheduled_at: new Date(localValue).toISOString() }
          : { scheduled_at: null, status: 'to_schedule' })
        return
      }
      if (!localValue || !group.resume_id) return
      await postSlot({
        resume_id: group.resume_id,
        candidate_name: group.candidate_name,
        candidate_email: group.candidate_email,
        job_post_id: group.job_post_id,
        round,
        scheduled_at: localValue,
      })
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save slot')
    }
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

  const colCount = 12 + slotCount * 2

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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Optional date / time slots</p>
            {form.slots.map((slot, i) => (
              <label key={i} className="block text-[11px] font-bold text-slate-600">
                {ordinal(i + 1)} slot {i === 0 ? '' : '(optional)'}
                <input
                  type="datetime-local"
                  data-testid={`schedule-slot-${i + 1}`}
                  value={slot}
                  onChange={e => setForm(f => {
                    const slots = [...f.slots]
                    slots[i] = e.target.value
                    return { ...f, slots }
                  })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, slots: [...f.slots, ''] }))}
              className="text-xs font-extrabold text-indigo-700 hover:underline"
            >
              + Add another slot
            </button>
            <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value as typeof form.format }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm appearance-none">
              <option value="video">Virtual</option>
              <option value="phone">Phone</option>
              <option value="in_person">Face-to-Face</option>
            </select>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <button type="button" onClick={schedule} disabled={scheduling || !form.resume_id}
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
          <table className="ent-table">
            <thead>
              <tr>
                <th className="col-id">Cand. ID</th>
                <th className="col-id">Int. ID</th>
                {Array.from({ length: slotCount }, (_, i) => (
                  <Fragment key={`h-${i}`}>
                    <th className="col-date">{ordinal(i + 1)} Date</th>
                    <th className="col-date">{ordinal(i + 1)} Time</th>
                  </Fragment>
                ))}
                <th className="col-name">Name</th>
                <th className="col-phone">Phone</th>
                <th className="col-email">Email</th>
                <th className="col-client">Client / Project</th>
                <th className="col-role">Position</th>
                <th className="col-num">Exp.</th>
                <th className="col-num">Current Sal.</th>
                <th className="col-num">Expected Sal.</th>
                <th className="col-status">Feedback</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-10 text-slate-400">No interviews in this filter</td></tr>
              ) : grouped.map(g => {
                const iv = g.primary
                return (
                  <tr key={g.key}>
                    <td className="col-id">
                      <EntityIdLink
                        kind="candidate"
                        id={g.candidate_short_id}
                        onClick={g.resume_id || g.candidate_short_id ? () => onOpenCandidate?.(g.resume_id || g.candidate_short_id!) : undefined}
                      />
                    </td>
                    <td className="col-id">
                      <EntityIdLink kind="interview" id={iv.short_id} onClick={() => openEdit(iv)} />
                    </td>
                    {Array.from({ length: slotCount }, (_, i) => (
                      <SlotPair
                        key={`${g.key}-r${i + 1}-${g.byRound.get(i + 1)?.id || ''}-${g.byRound.get(i + 1)?.scheduled_at || ''}`}
                        round={i + 1}
                        interview={g.byRound.get(i + 1)}
                        testId={`interview-slot-${i + 1}`}
                        onCommit={(round, local, existing) => { void commitSlot(g, round, local, existing) }}
                      />
                    ))}
                    <td className="col-name">
                      <button
                        type="button"
                        className="text-left font-semibold text-[13px] text-slate-900 hover:text-indigo-700"
                        onClick={() => (g.resume_id || g.candidate_short_id) && onOpenCandidate?.(g.resume_id || g.candidate_short_id!)}
                      >
                        {g.candidate_name}
                      </button>
                    </td>
                    <td className="col-phone">{formatPhoneInternational(g.candidate_phone) || g.candidate_phone || '—'}</td>
                    <td className="col-email">{g.candidate_email || '—'}</td>
                    <td className="col-client">{g.job_client_name || '—'}</td>
                    <td className="col-role">{g.job_title || '—'}</td>
                    <td className="col-num">{formatExpYears(g.years_experience)}</td>
                    <td className="col-num">{g.current_salary || '—'}</td>
                    <td className="col-num">{g.expected_salary || '—'}</td>
                    <td className="col-status" onClick={e => e.stopPropagation()}>
                      <select
                        value={iv.status}
                        onChange={e => patchInterview(iv.id, { status: e.target.value })}
                        className="text-xs font-semibold rounded-full border border-slate-200 px-2 py-0.5 bg-white appearance-none"
                      >
                        {INTERVIEW_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-actions">
                      <button type="button" onClick={() => openEdit(iv)} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                      <button
                        type="button"
                        data-testid="add-interview-slot"
                        onClick={() => setExtraCols(n => n + 1)}
                        className="ml-2 text-xs font-bold text-slate-600 hover:underline"
                      >
                        Add slot
                      </button>
                      {iv.status !== 'cancelled' && (
                        <button type="button" onClick={() => cancelInterview(iv.id)} className="ml-2 text-xs text-red-600 hover:underline">Cancel</button>
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
