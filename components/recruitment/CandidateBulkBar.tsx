'use client'

import { useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { LIFECYCLE_STATUSES, LIFECYCLE_LABELS } from '@/lib/candidateLifecycle'

type TeamMember = { user_id: string; name: string | null; email: string; role: string }

export function CandidateBulkBar({
  selectedIds,
  teamMembers,
  onClear,
  onDone,
  onExportSelected,
}: {
  selectedIds: string[]
  teamMembers: TeamMember[]
  onClear: () => void
  onDone: () => void
  onExportSelected?: (ids: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!selectedIds.length) return null

  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/candidates/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error ?? 'Bulk action failed')
        return
      }
      setMsg(`Updated ${data.updated} record(s).`)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
      <span className="text-sm font-semibold text-indigo-900">{selectedIds.length} selected</span>
      <select
        disabled={busy}
        defaultValue=""
        onChange={e => {
          const v = e.target.value
          if (v) bulk('change_lifecycle', { lifecycle_status: v })
          e.target.value = ''
        }}
        className="text-xs rounded-lg border border-indigo-200 bg-white px-2 py-1.5"
      >
        <option value="">Change status…</option>
        {LIFECYCLE_STATUSES.map(s => (
          <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>
        ))}
      </select>
      <select
        disabled={busy}
        defaultValue=""
        onChange={e => {
          const v = e.target.value
          if (v) bulk('assign_recruiter', { user_id: v })
          e.target.value = ''
        }}
        className="text-xs rounded-lg border border-indigo-200 bg-white px-2 py-1.5"
      >
        <option value="">Assign recruiter…</option>
        {teamMembers.map(m => (
          <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => bulk('archive')}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        Archive / Hold
      </button>
      {onExportSelected && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportSelected(selectedIds)}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        >
          <Download className="w-3.5 h-3.5" /> Export selected
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
      >
        <X className="w-3.5 h-3.5" /> Clear
      </button>
      {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
      {msg && <span className="text-xs text-indigo-800">{msg}</span>}
    </div>
  )
}
