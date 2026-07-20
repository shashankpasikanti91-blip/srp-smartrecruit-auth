'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Calendar, Loader2, MessageSquare, Send } from 'lucide-react'

/** Linked Recruitment OS objects for Candidate 360 */
export function CandidateLinkedPanel({
  candidateId,
  kind,
}: {
  candidateId: string
  kind: 'submissions' | 'interviews' | 'offers' | 'followups'
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (kind === 'submissions') {
        const res = await fetch(`/api/submissions?resume_id=${candidateId}&limit=20`)
        const data = await res.json()
        setRows(data.submissions ?? [])
      } else if (kind === 'interviews') {
        const res = await fetch(`/api/interviews?resume_id=${candidateId}`)
        const data = await res.json()
        setRows(data.interviews ?? [])
      } else if (kind === 'offers') {
        const res = await fetch(`/api/offers?resume_id=${candidateId}`)
        const data = await res.json()
        setRows(data.offers ?? [])
      } else {
        const res = await fetch(`/api/follow-ups?resume_id=${candidateId}`)
        const data = await res.json()
        setRows(data.follow_ups ?? data.items ?? [])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [candidateId, kind])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">No {kind} linked to this candidate yet.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r, i) => {
        const id = String(r.id ?? i)
        if (kind === 'submissions') {
          return (
            <li key={id} className="px-5 py-3 flex items-start gap-3">
              <Send className="w-4 h-4 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 font-mono">{String(r.short_id ?? '—')}</p>
                <p className="text-xs text-slate-600">{String(r.client_name ?? '—')} · {String(r.stage ?? '').replace(/_/g, ' ')}</p>
              </div>
            </li>
          )
        }
        if (kind === 'interviews') {
          return (
            <li key={id} className="px-5 py-3 flex items-start gap-3">
              <Calendar className="w-4 h-4 text-teal-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 font-mono">{String(r.short_id ?? '—')}</p>
                <p className="text-xs text-slate-600">
                  {r.scheduled_at ? new Date(String(r.scheduled_at)).toLocaleString() : '—'} · {String(r.status ?? '').replace(/_/g, ' ')}
                  {r.round != null ? ` · Round ${r.round}` : ''}
                </p>
              </div>
            </li>
          )
        }
        if (kind === 'offers') {
          return (
            <li key={id} className="px-5 py-3 flex items-start gap-3">
              <Briefcase className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 font-mono">{String(r.short_id ?? '—')}</p>
                <p className="text-xs text-slate-600">
                  {String(r.status ?? '').replace(/_/g, ' ')} · {String(r.offer_salary ?? '—')} · Joining {r.expected_joining ? String(r.expected_joining).slice(0, 10) : '—'}
                </p>
              </div>
            </li>
          )
        }
        return (
          <li key={id} className="px-5 py-3 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-violet-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">{String(r.title ?? 'Follow-up')}</p>
              <p className="text-xs text-slate-600">
                {r.due_at ? new Date(String(r.due_at)).toLocaleString() : '—'} · {String(r.status ?? '')}
                {r.source ? ` · ${r.source}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
