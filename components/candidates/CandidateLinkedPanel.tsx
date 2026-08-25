'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { CandidateAllocatePanel } from '@/components/candidates/CandidateAllocatePanel'

/** Linked Recruitment OS objects for Candidate 360 */
export function CandidateLinkedPanel({
  candidateId,
  kind,
}: {
  candidateId: string
  kind: 'submissions' | 'interviews' | 'offers' | 'followups'
}) {
  const [identity, setIdentity] = useState({ name: '', email: '' as string | null })
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(kind === 'followups')

  useEffect(() => {
    fetch(`/api/candidates/${candidateId}`)
      .then(r => r.json())
      .then(d => setIdentity({
        name: d.candidate?.candidate_name ?? '',
        email: d.candidate?.candidate_email ?? null,
      }))
      .catch(() => {})
  }, [candidateId])

  const loadFollowUps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/follow-ups?resume_id=${candidateId}`)
      const data = await res.json()
      setRows(data.follow_ups ?? data.items ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    if (kind === 'followups') void loadFollowUps()
  }, [kind, loadFollowUps])

  if (kind === 'submissions' || kind === 'interviews' || kind === 'offers') {
    return (
      <CandidateAllocatePanel
        candidateId={candidateId}
        candidateName={identity.name || 'Candidate'}
        candidateEmail={identity.email}
      />
    )
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">No follow-ups linked to this candidate yet.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r, i) => (
        <li key={String(r.id ?? i)} className="px-5 py-3 flex items-start gap-3">
          <MessageSquare className="w-4 h-4 text-violet-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-900">{String(r.title ?? 'Follow-up')}</p>
            <p className="text-xs text-slate-600">
              {r.due_at ? new Date(String(r.due_at)).toLocaleString() : '—'} · {String(r.status ?? '')}
              {r.source ? ` · ${r.source}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
