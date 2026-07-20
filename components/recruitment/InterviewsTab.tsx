'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Download, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { exportCsv } from '@/lib/exportCsv'
import { INTERVIEW_STATUSES } from '@/lib/recruitmentOs'

type Interview = {
  id: string
  short_id: string
  resume_id: string
  candidate_name: string
  candidate_email: string
  job_title: string | null
  scheduled_at: string
  duration_minutes: number
  format: string | null
  status: string
  meet_link: string | null
  interviewer_name: string | null
  round?: number
  rating?: number | null
}

type CandPick = { id: string; short_id: string; candidate_name: string; candidate_email: string }

export function InterviewsTab() {
  const [rows, setRows] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
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
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState('3')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const res = await fetch(`/api/interviews?${params}`)
      const data = await res.json()
      setRows(data.interviews ?? [])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

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

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Calendar className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Interviews</h1>
            <p className="text-sm text-slate-500 mt-0.5">Schedule and track interview rounds</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowSchedule(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
            <Plus className="w-4 h-4" /> Schedule
          </button>
          <button
            type="button"
            onClick={() => exportCsv(
              `interviews-${status || 'all'}.csv`,
              ['ID', 'Candidate', 'Email', 'Job', 'Scheduled', 'Duration', 'Format', 'Status', 'Interviewer'],
              rows.map(r => [r.short_id, r.candidate_name, r.candidate_email, r.job_title, r.scheduled_at, r.duration_minutes, r.format, r.status, r.interviewer_name]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">All statuses</option>
          {['scheduled','confirmed','completed','cancelled','no_show'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>ID</th><th>Candidate</th><th>Job</th><th>When</th><th>Round</th><th>Format</th><th>Status</th><th>Interviewer</th><th>Link</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">No interviews scheduled</td></tr>
              ) : rows.map((iv, i) => (
                <tr key={iv.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                  <td className="font-mono text-xs font-bold">{iv.short_id}</td>
                  <td>
                    <p className="font-medium text-sm">{iv.candidate_name}</p>
                    <p className="text-xs text-slate-500">{iv.candidate_email}</p>
                  </td>
                  <td>{iv.job_title || '—'}</td>
                  <td className="text-xs whitespace-nowrap">{new Date(iv.scheduled_at).toLocaleString()}</td>
                  <td className="text-xs font-bold">{iv.round ?? 1}</td>
                  <td className="capitalize text-sm">{iv.format || '—'}</td>
                  <td>
                    <select value={iv.status} onChange={e => patchInterview(iv.id, { status: e.target.value })}
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white appearance-none max-w-[150px]">
                      {INTERVIEW_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-sm">{iv.interviewer_name || '—'}</td>
                  <td>{iv.meet_link ? <a href={iv.meet_link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Join</a> : '—'}</td>
                  <td className="space-x-1 whitespace-nowrap">
                    {iv.status !== 'cancelled' && (
                      <button type="button" onClick={() => cancelInterview(iv.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                    )}
                    <button type="button" onClick={() => { setFeedbackId(iv.id); setFeedback('') }}
                      className="text-xs text-indigo-600 hover:underline">Feedback</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {feedbackId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFeedbackId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900">Interview feedback</h2>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Notes for the hiring team…" />
            <select value={rating} onChange={e => setRating(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm appearance-none">
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Rating {n}/5</option>)}
            </select>
            <button type="button" onClick={async () => {
              await patchInterview(feedbackId, { feedback, rating: Number(rating), status: 'completed' })
              setFeedbackId(null)
            }} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Save feedback</button>
          </div>
        </div>
      )}
    </div>
  )
}
