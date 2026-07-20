'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw, Send } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'

type Submission = {
  id: string
  short_id: string
  client_name: string | null
  applying_for: string | null
  stage: string
  hire_type: string | null
  submission_date: string | null
  candidate_name: string
  candidate_email: string
  candidate_short_id: string
  job_title: string | null
  recruiter_name: string | null
  updated_at: string
}

export function SubmissionsTab({ onOpenCandidate }: { onOpenCandidate?: (shortId: string) => void }) {
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState('')
  const [client, setClient] = useState('')

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

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Send className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Submissions</h1>
            <p className="text-sm text-slate-500 mt-0.5">{rows.length} in queue</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/api/submissions/export'
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap gap-3">
        <select value={stage} onChange={e => setStage(e.target.value)} className="text-sm rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">All stages</option>
          {['draft','submitted','client_review','shortlisted','interview','offer','joined','rejected','hold'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <input value={client} onChange={e => setClient(e.target.value)} placeholder="Filter client…" className="text-sm rounded-lg border border-slate-200 px-3 py-1.5" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>ID</th><th>Candidate</th><th>Client</th><th>Applying For</th><th>Stage</th><th>Job</th><th>Recruiter</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No submissions yet</td></tr>
              ) : rows.map((s, i) => (
                <tr key={s.id} className={i % 2 ? 'bg-slate-50/70' : ''}>
                  <td className="font-mono text-xs">{s.short_id}</td>
                  <td>
                    <button type="button" className="text-left text-indigo-700 hover:underline font-medium text-sm"
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
                      onChange={async e => {
                        const newStage = e.target.value
                        await fetch(`/api/submissions/${s.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ stage: newStage }),
                        })
                        load()
                      }}
                      className="text-xs capitalize rounded-lg border border-slate-200 px-2 py-1 bg-white"
                    >
                      {['draft','submitted','client_review','shortlisted','interview','offer','joined','rejected','hold'].map(st => (
                        <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td>{s.job_title || '—'}</td>
                  <td>{s.recruiter_name || '—'}</td>
                  <td className="text-xs text-slate-500">{s.submission_date ? new Date(s.submission_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}
    </div>
  )
}
