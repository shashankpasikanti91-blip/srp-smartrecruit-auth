'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, Send, X } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { OpsListChrome } from '@/components/recruitment/OpsListChrome'
import { EntityIdLink } from '@/components/ui/EntityIdLink'
import { EntityNotesTimeline } from '@/components/ui/EntityNotesTimeline'
import { SUBMISSION_STAGES, labelFor } from '@/lib/recruitmentOs'
import { presetToRange, type DatePreset } from '@/lib/datePresets'
import { formatIsoDate } from '@/lib/opsList'
import { formatPhoneInternational } from '@/lib/phoneFormat'

type Submission = {
  id: string
  short_id: string
  resume_id: string
  client_name: string | null
  client_project?: string | null
  applying_for: string | null
  stage: string
  hire_type: string | null
  submission_date: string | null
  notes: string | null
  candidate_name: string
  candidate_email: string
  candidate_phone?: string | null
  candidate_short_id: string
  job_title: string | null
  recruiter_name: string | null
  updated_at: string
  feedback_detail?: string | null
  feedback_recorded_by?: string | null
  feedback_date?: string | null
  feedback?: { detail?: string; text?: string; recorded_by?: string; recorded_at?: string } | null
}

type HistoryRow = {
  id: string
  action: string
  old_stage: string | null
  new_stage: string | null
  created_at: string
}

type Summary = {
  all: number
  awaiting: number
  positive: number
  kiv: number
  rejected: number
}

const FEEDBACK_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: 'Awaiting' },
  { id: 'positive', label: 'Positive' },
  { id: 'kiv', label: 'KIV' },
  { id: 'rejected', label: 'Rejected' },
] as const

function stageBadgeClass(stage: string) {
  if (['rejected', 'rejected_by_candidate', 'no_show', 'offer_declined'].includes(stage)) {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }
  if (['selected', 'shortlisted', 'offer_accepted', 'joined', 'offer_released'].includes(stage)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (['hold', 'position_closed', 'duplicate'].includes(stage)) {
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }
  return 'bg-sky-50 text-sky-800 border-sky-200'
}

export function SubmissionsTab({
  onOpenCandidate,
  isManager = false,
}: {
  onOpenCandidate?: (idOrShortId: string) => void
  isManager?: boolean
}) {
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('all')
  const [preset, setPreset] = useState<DatePreset | string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(!isManager)
  const [canToggleMine, setCanToggleMine] = useState(isManager)
  const [summary, setSummary] = useState<Summary>({ all: 0, awaiting: 0, positive: 0, kiv: 0, rejected: 0 })
  const [detail, setDetail] = useState<Submission | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [feedbackDraft, setFeedbackDraft] = useState('')
  const [detailDraft, setDetailDraft] = useState('')

  const buildParams = useCallback((forExport = false) => {
    const params = new URLSearchParams()
    if (feedback && feedback !== 'all') params.set('feedback', feedback)
    if (search.trim()) params.set('q', search.trim())
    if (mine) params.set('mine', '1')
    else if (isManager) params.set('mine', '0')
    const range = dateFrom || dateTo ? { from: dateFrom, to: dateTo } : presetToRange(preset)
    if (range?.from) params.set('date_from', range.from)
    if (range?.to) params.set('date_to', range.to)
    if (!forExport) params.set('limit', '100')
    return params
  }, [feedback, search, mine, isManager, dateFrom, dateTo, preset])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/submissions?${buildParams()}`)
      const data = await res.json()
      setRows(data.submissions ?? [])
      if (data.summary) setSummary(data.summary)
      if (typeof data.can_toggle_mine === 'boolean') setCanToggleMine(data.can_toggle_mine)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setMine(!isManager)
  }, [isManager])

  const onPreset = (v: DatePreset) => {
    setPreset(v)
    setDateFrom('')
    setDateTo('')
  }

  const openDetail = async (s: Submission) => {
    setDetail(s)
    setNotesDraft(s.notes ?? '')
    setFeedbackDraft('')
    setDetailDraft(s.feedback_detail ?? '')
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/submissions/${s.id}`)
      const data = await res.json()
      if (data.submission) {
        setDetail({ ...s, ...data.submission })
        setNotesDraft(data.submission.notes ?? '')
        const fb = data.submission.feedback
        if (fb && typeof fb === 'object') {
          setFeedbackDraft(String((fb as { text?: string }).text ?? ''))
          setDetailDraft(String((fb as { detail?: string }).detail ?? (fb as { text?: string }).text ?? ''))
        }
      }
      setHistory((data.history ?? []) as HistoryRow[])
    } finally {
      setDetailLoading(false)
    }
  }

  const saveNotes = async () => {
    if (!detail) return
    await fetch(`/api/submissions/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notesDraft,
        feedback: {
          text: feedbackDraft || detailDraft,
          detail: detailDraft || feedbackDraft,
          recorded_by: detail.recruiter_name || 'Recruiter',
          recorded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    })
    load()
    setDetail(d => (d ? { ...d, notes: notesDraft, feedback_detail: detailDraft } : d))
  }

  const patchStage = async (id: string, newStage: string) => {
    await fetch(`/api/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    load()
    if (detail?.id === id) {
      setDetail(d => (d ? { ...d, stage: newStage } : d))
    }
  }

  const exportWith = (format: 'csv' | 'xlsx') => {
    const p = buildParams(true)
    p.set('format', format)
    window.location.href = `/api/submissions/export?${p}`
  }

  const pills = FEEDBACK_PILLS.map(p => ({
    id: p.id,
    label: p.label,
    count: summary[p.id as keyof Summary] ?? 0,
  }))

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Send className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Client Submissions</h1>
            <p className="text-sm text-slate-500 mt-0.5">{summary.all} in scope · clear Cand. / Submission IDs</p>
          </div>
        </div>
      </div>

      <OpsListChrome
        scopeMine={mine}
        showMineToggle={canToggleMine || isManager}
        onToggleMine={setMine}
        preset={preset}
        onPreset={onPreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={v => { setDateFrom(v); setPreset('') }}
        onDateTo={v => { setDateTo(v); setPreset('') }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, RES-, SUB-, client…"
        pills={pills}
        activePill={feedback}
        onPill={setFeedback}
        onExportCsv={() => exportWith('csv')}
        onExportXlsx={() => exportWith('xlsx')}
        onRefresh={load}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table">
            <thead>
              <tr>
                <th className="col-id">Cand. ID</th>
                <th className="col-id">Sub. ID</th>
                <th className="col-name">Name</th>
                <th className="col-phone">Phone</th>
                <th className="col-email">Email</th>
                <th className="col-client">Client</th>
                <th className="col-hire">Hire Type</th>
                <th className="col-role">Role</th>
                <th className="col-person">Recruiter</th>
                <th className="col-date">Submitted</th>
                <th className="col-date">Feedback date</th>
                <th className="col-status">Feedback status</th>
                <th className="col-text">Detail</th>
                <th className="col-person">Recorded by</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-10 text-slate-400">No submissions in this filter</td></tr>
              ) : rows.map(s => (
                <tr key={s.id}>
                  <td className="col-id">
                    <EntityIdLink
                      kind="candidate"
                      id={s.candidate_short_id}
                      onClick={() => onOpenCandidate?.(s.resume_id || s.candidate_short_id)}
                    />
                  </td>
                  <td className="col-id">
                    <EntityIdLink kind="submission" id={s.short_id} onClick={() => openDetail(s)} />
                  </td>
                  <td className="col-name">
                    <button
                      type="button"
                      className="text-left font-semibold text-[13px] text-slate-900 hover:text-indigo-700"
                      onClick={() => onOpenCandidate?.(s.resume_id || s.candidate_short_id)}
                    >
                      {s.candidate_name}
                    </button>
                  </td>
                  <td className="col-phone">{formatPhoneInternational(s.candidate_phone) || s.candidate_phone || '—'}</td>
                  <td className="col-email">{s.candidate_email || '—'}</td>
                  <td className="col-client">{s.client_project || s.client_name || '—'}</td>
                  <td className="col-hire capitalize">{s.hire_type ? s.hire_type.replace(/_/g, ' ') : '—'}</td>
                  <td className="col-role">{s.applying_for || s.job_title || '—'}</td>
                  <td className="col-person">{s.recruiter_name || '—'}</td>
                  <td className="col-date">{formatIsoDate(s.submission_date) || '—'}</td>
                  <td className="col-date">{formatIsoDate(s.feedback_date) || '—'}</td>
                  <td className="col-status" onClick={e => e.stopPropagation()}>
                    <select
                      value={s.stage}
                      onChange={e => patchStage(s.id, e.target.value)}
                      className={`text-xs font-semibold rounded-full border px-2 py-0.5 appearance-none ${stageBadgeClass(s.stage)}`}
                    >
                      {SUBMISSION_STAGES.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="col-text" title={s.feedback_detail || ''}>
                    {s.feedback_detail || '—'}
                  </td>
                  <td className="col-person">
                    {s.feedback_recorded_by || (s.feedback_detail ? s.recruiter_name : null) || '—'}
                  </td>
                  <td className="col-actions whitespace-nowrap">
                    <button type="button" onClick={() => openDetail(s)} className="text-xs font-bold text-indigo-700 hover:underline">
                      Update feedback
                    </button>
                    <span className="text-slate-300 mx-1">·</span>
                    <button type="button" onClick={() => onOpenCandidate?.(s.resume_id || s.candidate_short_id)} className="text-xs font-bold text-slate-600 hover:underline">
                      Open profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Submission</p>
                <h2 className="page-title text-lg font-mono">{detail.short_id}</h2>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{detail.candidate_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cand. ID{' '}
                  <EntityIdLink kind="candidate" id={detail.candidate_short_id} onClick={() => onOpenCandidate?.(detail.resume_id || detail.candidate_short_id)} />
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Status', labelFor(SUBMISSION_STAGES, detail.stage)],
                  ['Client', detail.client_name || '—'],
                  ['Position', detail.applying_for || '—'],
                  ['Hire type', detail.hire_type || '—'],
                  ['Job', detail.job_title || '—'],
                  ['Recruiter', detail.recruiter_name || '—'],
                  ['Email', detail.candidate_email || '—'],
                  ['Date', detail.submission_date ? new Date(detail.submission_date).toLocaleDateString() : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">{k}</p>
                    <p className="font-bold text-slate-800 break-all">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-400 mb-1">Feedback detail</p>
                <textarea className="form-input w-full" rows={2} value={detailDraft} onChange={e => setDetailDraft(e.target.value)} placeholder="Short feedback detail shown in list…" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-400 mb-1">Client feedback</p>
                <textarea className="form-input w-full" rows={3} value={feedbackDraft} onChange={e => setFeedbackDraft(e.target.value)} placeholder="Update feedback…" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-400 mb-1">Recruiter notes (legacy field)</p>
                <textarea className="form-input w-full" rows={3} value={notesDraft} onChange={e => setNotesDraft(e.target.value)} />
                <button type="button" onClick={saveNotes} className="btn-primary mt-2 !py-1.5 !px-3 text-xs">Save feedback</button>
              </div>
              <EntityNotesTimeline
                entityType="submission"
                entityId={detail.id}
                title="Submission note thread"
                subtitle="Append recruiter and client-feedback notes over time."
                defaultCategory="recruiter"
                allowedCategories={['recruiter', 'client_feedback', 'internal', 'follow_up', 'general']}
              />
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-400 mb-2 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Timeline / history</p>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No history yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map(h => (
                      <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                        <p className="font-bold text-slate-800">{h.action}{h.old_stage ? `: ${h.old_stage} → ${h.new_stage}` : ''}</p>
                        <p className="text-slate-500">{new Date(h.created_at).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => onOpenCandidate?.(detail.resume_id || detail.candidate_short_id)}>Open Candidate 360</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
