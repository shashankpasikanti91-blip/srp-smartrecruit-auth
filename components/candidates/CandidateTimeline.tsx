'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Brain, Edit, FileUp, Loader2, Mail, MessageCircle, Phone, RefreshCw, UserCheck,
} from 'lucide-react'

type TimelineEvent = {
  id: string
  type: string
  title: string
  detail?: string | null
  actor_email?: string | null
  at: string
}

function iconFor(type: string) {
  if (type.startsWith('comm_email')) return Mail
  if (type.startsWith('comm_whatsapp')) return MessageCircle
  if (type.startsWith('comm_call')) return Phone
  if (type.includes('document') || type.includes('resume')) return FileUp
  if (type.includes('ai')) return Brain
  if (type.includes('interview')) return UserCheck
  if (type.includes('stage') || type.includes('lifecycle')) return RefreshCw
  return Edit
}

function fmtWhen(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function CandidateTimeline({ candidateId }: { candidateId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const load = useCallback(async (cursor?: string | null, append = false) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null) }
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/candidates/${candidateId}/timeline?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load timeline')
        return
      }
      setEvents(prev => append ? [...prev, ...(data.events ?? [])] : (data.events ?? []))
      setNextCursor(data.next_cursor ?? null)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [candidateId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading activity…
      </div>
    )
  }

  return (
    <div className="p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Activity timeline</p>
        <button type="button" onClick={() => load()} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          Refresh
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-4">{error}</div>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-0 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
          {events.map(ev => {
            const Icon = iconFor(ev.type)
            return (
              <li key={ev.id} className="relative pl-10 pb-5">
                <span className="absolute left-0 top-0.5 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-indigo-600" />
                </span>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-900">{ev.title}</p>
                  {ev.detail && <p className="text-xs text-slate-600 mt-0.5">{ev.detail}</p>}
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {fmtWhen(ev.at)}
                    {ev.actor_email ? ` · ${ev.actor_email}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {nextCursor && (
        <button type="button" onClick={() => load(nextCursor, true)} disabled={loadingMore}
          className="mt-4 w-full py-2 rounded-lg border border-slate-200 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Load more activity'}
        </button>
      )}
    </div>
  )
}
