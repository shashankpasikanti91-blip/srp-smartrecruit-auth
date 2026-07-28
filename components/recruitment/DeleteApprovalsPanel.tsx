'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, ShieldAlert, X } from 'lucide-react'

type DeleteReq = {
  id: string
  resource_type: 'candidate' | 'job' | 'client'
  resource_id: string
  resource_label: string | null
  reason: string | null
  status: string
  requested_at: string
  requester_email?: string | null
  requester_name?: string | null
}

export function DeleteApprovalsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<DeleteReq[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/delete-requests?status=pending')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to load')
        setRows([])
        return
      }
      setRows(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/delete-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Action failed')
        return
      }
      await load()
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-rose-50/50">
        <ShieldAlert className="w-4 h-4 text-rose-600" />
        <div>
          <p className="text-sm font-extrabold text-slate-900">Delete approvals</p>
          <p className="text-[11px] font-medium text-slate-500">
            Team delete requests — approve to remove, or reject
          </p>
        </div>
        <button type="button" onClick={load} className="ml-auto text-xs font-bold text-indigo-700 hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
      ) : error ? (
        <p className="p-4 text-sm text-rose-700 font-semibold">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm font-medium text-slate-500">No pending delete requests.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(r => (
            <li key={r.id} className="px-4 py-3 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-900 truncate">
                  {r.resource_label || r.resource_id}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                  {r.resource_type} · by {r.requester_name || r.requester_email || 'team'}
                  {' · '}
                  {new Date(r.requested_at).toLocaleString()}
                </p>
                {r.reason ? (
                  <p className="text-xs text-slate-600 mt-1">Reason: {r.reason}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => review(r.id, 'approved')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => review(r.id, 'rejected')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 text-xs font-bold disabled:opacity-50"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
