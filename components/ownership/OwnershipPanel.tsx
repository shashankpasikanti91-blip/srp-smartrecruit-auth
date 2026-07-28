'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock, Loader2, UserRound, RefreshCw, ArrowRightLeft, Archive } from 'lucide-react'
import { DEFAULT_OWNERSHIP_DAYS } from '@/lib/ownershipConstants'

export type OwnershipPayload = {
  id: string
  owner_user_id: string
  owner_name?: string | null
  owner_email?: string | null
  assigned_at: string
  valid_until: string
  status: string
  expired?: boolean
  transfer_reason?: string | null
}

type HistoryRow = {
  id: string
  action: string
  reason?: string | null
  created_at: string
  from_name?: string | null
  to_name?: string | null
  actor_email?: string | null
}

type TeamMember = { user_id: string; name: string | null; email: string; role: string }

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

function daysLeft(validUntil: string) {
  const ms = new Date(validUntil).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function OwnershipPanel({
  entityType,
  entityId,
  initialOwnership,
  initialHistory,
  teamMembers = [],
  canManage = false,
  compact = false,
}: {
  entityType: 'candidate' | 'job' | 'client' | 'submission'
  entityId: string
  initialOwnership?: OwnershipPayload | null
  initialHistory?: HistoryRow[]
  teamMembers?: TeamMember[]
  canManage?: boolean
  compact?: boolean
}) {
  const [ownership, setOwnership] = useState<OwnershipPayload | null>(initialOwnership ?? null)
  const [history, setHistory] = useState<HistoryRow[]>(initialHistory ?? [])
  const [loading, setLoading] = useState(!initialOwnership)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [toUserId, setToUserId] = useState('')
  const [reason, setReason] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entityType, entityId })
      const res = await fetch(`/api/ownership?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load ownership')
        return
      }
      setOwnership(data.ownership ?? null)
      setHistory(data.history ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    if (!initialOwnership) load()
    else {
      setOwnership(initialOwnership)
      setHistory(initialHistory ?? [])
    }
  }, [initialOwnership, initialHistory, load])

  const act = async (action: 'extend' | 'transfer' | 'archive' | 'assign', extra?: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return
      }
      setOwnership(data.ownership ?? null)
      setShowTransfer(false)
      setReason('')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ownership…
      </div>
    )
  }

  const expired = ownership?.expired || (ownership ? daysLeft(ownership.valid_until) < 0 : false)
  const left = ownership ? daysLeft(ownership.valid_until) : null

  return (
    <div className={`rounded-xl border ${expired ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50/80'} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <UserRound className="w-3.5 h-3.5" /> Ownership
          </p>
          {ownership ? (
            <>
              <p className="text-sm font-extrabold text-slate-900 mt-1 truncate">
                {ownership.owner_name || ownership.owner_email || 'Assigned recruiter'}
              </p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                <span>Since {fmtDate(ownership.assigned_at)}</span>
                <span>· Until {fmtDate(ownership.valid_until)}</span>
                {left != null && (
                  <span className={expired ? 'text-amber-800 font-bold' : ''}>
                    · {expired ? 'Expired' : `${left}d left`}
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-500 mt-1">No active ownership record</p>
          )}
        </div>
        <button type="button" onClick={load} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {expired && ownership && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold">Ownership expired</p>
            <p className="mt-0.5 text-amber-900/80">Extend, transfer to another recruiter, or archive.</p>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {canManage && ownership && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('extend', { extendDays: DEFAULT_OWNERSHIP_DAYS, reason: reason || 'Extended 90 days' })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold disabled:opacity-50"
            >
              <Clock className="w-3 h-3" /> Extend {DEFAULT_OWNERSHIP_DAYS}d
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowTransfer(v => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-extrabold"
            >
              <ArrowRightLeft className="w-3 h-3" /> Transfer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm('Archive this ownership?')) act('archive', { reason: reason || 'Archived' })
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-extrabold"
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
          </>
        )}
        {canManage && !ownership && teamMembers.length > 0 && (
          <button
            type="button"
            disabled={busy || !toUserId}
            onClick={() => act('assign', { toUserId, reason: reason || 'Initial assign' })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold disabled:opacity-50"
          >
            Assign owner
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHistory(v => !v)}
          className="text-[11px] font-bold text-indigo-700 hover:underline"
        >
          {showHistory ? 'Hide history' : `History (${history.length})`}
        </button>
      </div>

      {(showTransfer || (!ownership && canManage)) && teamMembers.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <select
            value={toUserId}
            onChange={e => setToUserId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Select recruiter…</option>
            {teamMembers.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || m.email} ({m.role})
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          />
          {showTransfer && (
            <button
              type="button"
              disabled={busy || !toUserId}
              onClick={() => act('transfer', { toUserId, reason: reason || 'Transferred' })}
              className="w-full py-2 rounded-lg bg-amber-600 text-white text-xs font-extrabold disabled:opacity-50"
            >
              Confirm transfer
            </button>
          )}
        </div>
      )}

      {showHistory && (
        <ul className="mt-3 space-y-1.5 max-h-40 overflow-auto">
          {history.length === 0 ? (
            <li className="text-xs text-slate-400">No history yet</li>
          ) : history.map(h => (
            <li key={h.id} className="text-[11px] text-slate-600 border-b border-slate-100 pb-1">
              <span className="font-bold capitalize">{h.action}</span>
              {h.to_name ? ` → ${h.to_name}` : ''}
              {h.reason ? ` · ${h.reason}` : ''}
              <span className="text-slate-400"> · {fmtDate(h.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
