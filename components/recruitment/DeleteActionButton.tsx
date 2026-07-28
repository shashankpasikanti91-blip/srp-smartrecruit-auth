'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

type ResourceType = 'candidate' | 'job' | 'client'

/**
 * Role-based delete control:
 * - owner/admin → deletes immediately (confirm)
 * - recruiter/member → submits approval request with optional reason
 */
export function DeleteActionButton({
  resourceType,
  resourceId,
  resourceLabel,
  canDirectDelete,
  onDone,
  className = '',
  compact = false,
}: {
  resourceType: ResourceType
  resourceId: string
  resourceLabel: string
  canDirectDelete: boolean
  onDone?: (result: { direct: boolean }) => void
  className?: string
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [askReason, setAskReason] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const label = canDirectDelete
    ? (resourceType === 'job' ? 'Delete / Archive' : resourceType === 'client' ? 'Deactivate' : 'Delete')
    : 'Request delete'

  const run = async (withReason?: string) => {
    setBusy(true)
    setError('')
    try {
      if (canDirectDelete) {
        const ok = window.confirm(
          resourceType === 'job'
            ? `Archive job “${resourceLabel}”? It will be removed from the active list.`
            : resourceType === 'client'
              ? `Deactivate client “${resourceLabel}”? It will disappear from the active client list.`
              : `Permanently delete candidate “${resourceLabel}”? This cannot be undone.`
        )
        if (!ok) return
      }

      const res = await fetch('/api/delete-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          resource_label: resourceLabel,
          reason: withReason || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Request failed')
        return
      }
      if (data.pending) {
        alert(`Delete request submitted for approval.\nAdmins/owners will review “${resourceLabel}”.`)
        setAskReason(false)
        setReason('')
        onDone?.({ direct: false })
      } else {
        onDone?.({ direct: true })
      }
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (askReason && !canDirectDelete) {
    return (
      <div className={`rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2 ${className}`} onClick={e => e.stopPropagation()}>
        <p className="text-xs font-bold text-rose-900">Request delete — {resourceLabel}</p>
        <textarea
          className="w-full text-xs rounded-lg border border-rose-200 px-2 py-1.5"
          rows={2}
          placeholder="Reason (required for team requests)"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        {error ? <p className="text-[11px] text-rose-700 font-semibold">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => run(reason.trim())}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit request'}
          </button>
          <button type="button" onClick={() => { setAskReason(false); setError('') }}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-bold">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={className} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (canDirectDelete) void run()
          else setAskReason(true)
        }}
        className={
          compact
            ? 'w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-1.5'
            : 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50'
        }
        title={canDirectDelete ? 'Owner/admin can delete directly' : 'Needs owner/admin approval'}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        {label}
      </button>
      {error ? <p className="text-[10px] text-rose-600 mt-1">{error}</p> : null}
    </div>
  )
}
