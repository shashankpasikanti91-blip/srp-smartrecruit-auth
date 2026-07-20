'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

export function CoachTab() {
  const [suggestions, setSuggestions] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ suggestions: string; created_at: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coach', { method: 'POST' })
      const data = await res.json()
      setSuggestions(data.suggestions ?? data.error ?? 'Coach unavailable')
      if (data.history) setHistory(data.history)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Sparkles className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">SRP AI Recruiter Coach</h1>
            <p className="text-sm text-slate-500 mt-0.5">Daily suggestions based on your KPI snapshot</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50">
          {loading ? 'Thinking…' : 'Refresh suggestions'}
        </button>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-6 mb-6">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Generating…</div>
        ) : suggestions ? (
          <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{suggestions}</div>
        ) : (
          <p className="text-sm text-slate-500">Click refresh to get AI coaching suggestions.</p>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-sm font-bold text-slate-700 mb-3">Previous suggestions</p>
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <p className="text-[10px] text-slate-400 mb-2">{new Date(h.created_at).toLocaleString()}</p>
                <p className="whitespace-pre-line line-clamp-4">{h.suggestions}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
