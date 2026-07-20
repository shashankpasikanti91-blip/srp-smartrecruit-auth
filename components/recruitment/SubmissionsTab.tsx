'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Download, Eye, History, Loader2, RefreshCw, Send, X,
} from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { SUBMISSION_STAGES, labelFor } from '@/lib/recruitmentOs'

type Submission = {
  id: string
  short_id: string
  client_name: string | null
  applying_for: string | null
  stage: string
  hire_type: string | null
  submission_date: string | null
  notes: string | null
  candidate_name: string
  candidate_email: string
  candidate_short_id: string
  job_title: string | null
  recruiter_name: string | null
  updated_at: string
}

type HistoryRow = {
  id: string
  action: string
  old_stage: string | null
  new_stage: string | null
  created_at: string
  details?: Record<string, unknown>
}

export function SubmissionsTab({ onOpenCandidate }: { onOpenCandidate?: (shortId: string) => void }) {
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState('')
  const [client, setClient] = useState('')
  const [detail, setDetail] = useState<Submission | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (stage) params.set('stage', stage)
      if (client) params.set('client', client)
      const res = await fetch(`/api/submissions?${params}`)
      const data = await res.json()
      setRows(data.submissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [stage, client])

  useEffect(() => { load() }, [load])

  const openDetail = async (s: Submission) => {
    setDetail(s)
    setNotesDraft(s.notes ?? '')
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/submissions/${s.id}`)
      const data = await res.json()
      if (data.submission) {
        setDetail({ ...s, ...data.submission })
        setNotesDraft(data.submission.notes ?? '')
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
      body: JSON.stringify({ notes: notesDraft }),
    })
    load()
    setDetail(d => d ? { ...d, notes: notesDraft } : d)
  }

  const patchStage = async (id: string, newStage: string) => {
    await fetch(`/api/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    load()
    if (detail?.id === id) {
      setDetail(d => d ? { ...d, stage: newStage } : d)
      openDetail({ ...detail, stage: newStage })
    }
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Send className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Submissions</h1>
            <p className="text-sm text-slate-500 mt-0.5">{rows.length} in queue · Recruitment OS lifecycle</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { window.location.href = '/api/submissions/export' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap gap-3">
        <select value={stage} onChange={e => setStage(e.target.value)} className="form-input !w-auto !py-1.5 !text-sm appearance-none">
          <option value="">All stages</option>
          {SUBMISSION_STAGES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input value={client} onChange={e => setClient(e.target.value)} placeholder="Filter client…" className="form-input !w-auto !py-1.5 !text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>Submission ID</th>
                <th>Candidate</th>
                <th>Client</th>
                <th>Position</th>
                <th>Status</th>
                <th>Job</th>
                <th>Recruiter</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">No submissions yet</td></tr>
              ) : rows.map((s, i) => (
                <tr key={s.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                  <td className="font-mono text-xs font-bold">{s.short_id}</td>
                  <td>
                    <button type="button" className="text-left text-indigo-700 hover:underline font-bold text-sm"
                      onClick={() => onOpenCandidate?.(s.candidate_short_id)}>
                      {s.candidate_name}
                    </button>
                    <p className="text-xs text-slate-500">{s.candidate_short_id}</p>
                  </td>
                  <td>{s.client_name || '—'}</td>
                  <td>{s.applying_for || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <select
                      value={s.stage}
                      onChange={e => patchStage(s.id, e.target.value)}
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white appearance-none max-w-[160px]"
                    >
                      {SUBMISSION_STAGES.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{s.job_title || '—'}</td>
                  <td>{s.recruiter_name || '—'}</td>
                  <td className="text-xs text-slate-500">{s.submission_date ? new Date(s.submission_date).toLocaleDateString() : '—'}</td>
                  <td>
                    <button type="button" onClick={() => openDetail(s)} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline">
                      <Eye className="w-3.5 h-3.5" /> View
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
                <p className="text-xs font-extrabold uppercase text-slate-400 mb-1">Recruiter notes</p>
                <textarea className="form-input w-full" rows={4} value={notesDraft} onChange={e => setNotesDraft(e.target.value)} />
                <button type="button" onClick={saveNotes} className="btn-primary mt-2 !py-1.5 !px-3 text-xs">Save notes</button>
              </div>
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
                <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => onOpenCandidate?.(detail.candidate_short_id)}>Open Candidate 360</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
