'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Check, Copy, Loader2, RefreshCw, X } from 'lucide-react'

type AgentSuggestion = {
  id: string
  agent_type: string
  title: string
  rationale?: string | null
  draft_message?: string | null
  draft_channel?: string | null
  resume_id?: string | null
  entity_type?: string | null
  entity_id?: string | null
  created_at?: string
}

export function AgentInboxPanel({
  onNavigate,
}: {
  onNavigate?: (tab: string, opts?: { candidateId?: string }) => void
}) {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents?status=pending&limit=20')
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resolve = async (id: string, action: 'accept' | 'dismiss', suggestion: AgentSuggestion) => {
    setActing(id)
    setMsg(null)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error ?? 'Action failed')
        return
      }
      if (action === 'accept' && suggestion.draft_message) {
        try {
          await navigator.clipboard.writeText(suggestion.draft_message)
          setMsg('Draft copied to clipboard')
        } catch {
          setMsg('Accepted — open comms to send draft')
        }
        if (suggestion.resume_id && onNavigate) {
          onNavigate('candidates', { candidateId: suggestion.resume_id })
        }
      } else if (action === 'accept') {
        setMsg('Suggestion accepted')
      }
      await load()
    } finally {
      setActing(null)
    }
  }

  const runSweep = async () => {
    setActing('sweep')
    setMsg(null)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sweep' }),
      })
      const data = await res.json()
      setMsg(`Sweep complete — ${data.created ?? 0} new suggestions`)
      await load()
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="ess-panel">
      <div className="ess-panel__head">
        <p className="ess-panel__title flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-600" /> Agent Inbox
        </p>
        <button
          type="button"
          onClick={runSweep}
          disabled={acting === 'sweep'}
          className="text-xs font-extrabold text-violet-700 inline-flex items-center gap-1"
        >
          {acting === 'sweep' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run sweep
        </button>
      </div>
      {msg && <p className="px-4 pt-2 text-xs font-bold text-emerald-700">{msg}</p>}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-600" /></div>
      ) : suggestions.length === 0 ? (
        <p className="px-4 py-8 text-sm font-bold text-slate-500 text-center">
          No pending agent recommendations. Run a sweep to scan submissions, interviews, offers &amp; docs.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {suggestions.map(s => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{s.title}</p>
                  <p className="text-[11px] font-bold text-violet-700 capitalize mt-0.5">{s.agent_type}</p>
                  {s.rationale && (
                    <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">{s.rationale}</p>
                  )}
                  {s.draft_message && (
                    <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
                      Draft ({s.draft_channel ?? 'email'}): {s.draft_message.slice(0, 60)}…
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={!!acting}
                    onClick={() => resolve(s.id, 'accept', s)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {acting === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Accept
                  </button>
                  {s.draft_message && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(s.draft_message!)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-extrabold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!!acting}
                    onClick={() => resolve(s.id, 'dismiss', s)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-extrabold text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
