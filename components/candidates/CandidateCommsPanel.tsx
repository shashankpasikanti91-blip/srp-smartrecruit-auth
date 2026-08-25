'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, MessageCircle, Paperclip, Shield } from 'lucide-react'

type CommRow = {
  id: string
  channel: string
  recipient?: string
  subject?: string | null
  body?: string | null
  status?: string
  delivery_status?: string | null
  template_name?: string | null
  message_type?: string | null
  created_at?: string
  opened_at?: string | null
  read_at?: string | null
  attachment_paths?: unknown
}

function statusBadge(status?: string | null) {
  const s = (status || 'pending').toLowerCase()
  const colors: Record<string, string> = {
    sent: 'bg-blue-50 text-blue-800 border-blue-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    opened: 'bg-violet-50 text-violet-800 border-violet-200',
    read: 'bg-violet-50 text-violet-800 border-violet-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return colors[s] ?? 'bg-slate-50 text-slate-700 border-slate-200'
}

/** Email or WhatsApp history for Candidate 360 */
export function CandidateCommsPanel({
  candidateId,
  channel,
}: {
  candidateId: string
  channel: 'email' | 'whatsapp'
}) {
  const [rows, setRows] = useState<CommRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/comms?channel=${channel}`)
      const data = await res.json()
      setRows(data.logs ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [candidateId, channel])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading {channel} history…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">
        No {channel === 'email' ? 'emails' : 'WhatsApp messages'} linked to this candidate yet.
      </p>
    )
  }

  const Icon = channel === 'email' ? Mail : MessageCircle

  return (
    <div className="p-5 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest">
          {channel === 'email' ? 'Email Center' : 'WhatsApp Center'}
        </p>
        <button type="button" onClick={() => load()} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
          Refresh
        </button>
      </div>
      <ul className="space-y-3">
        {rows.map(r => {
          const st = r.delivery_status || r.status || 'pending'
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-indigo-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {r.subject || r.message_type || (channel === 'email' ? 'Email' : 'WhatsApp')}
                    </p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${statusBadge(st)}`}>
                      {st}
                    </span>
                  </div>
                  {r.template_name && (
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Template: {r.template_name}</p>
                  )}
                  {r.body && (
                    <p className="text-sm font-medium text-slate-700 mt-2 whitespace-pre-wrap line-clamp-4">{r.body}</p>
                  )}
                  <p className="text-[10px] font-medium text-slate-400 mt-2">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    {r.recipient ? ` · To ${r.recipient}` : ''}
                    {r.opened_at ? ` · Opened ${new Date(r.opened_at).toLocaleString()}` : ''}
                    {r.read_at ? ` · Read ${new Date(r.read_at).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Audit logs for Candidate 360 */
export function CandidateAuditPanel({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/candidates/${candidateId}/audit`)
        const data = await res.json()
        if (!cancelled) setRows(data.logs ?? [])
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">No audit entries for this candidate yet.</p>
  }

  return (
    <div className="p-5 bg-white overflow-x-auto">
      <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5" /> Audit Logs
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {['Date / Time', 'User', 'Action', 'Module', 'Old', 'New', 'Reason'].map(h => (
              <th key={h} className="px-2 py-2 text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="hover:bg-slate-50">
              <td className="px-2 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                {r.created_at ? new Date(String(r.created_at)).toLocaleString() : '—'}
              </td>
              <td className="px-2 py-2 text-xs font-bold text-slate-800">{String(r.user_email ?? '—')}</td>
              <td className="px-2 py-2 text-xs font-bold text-slate-900">{String(r.action ?? '').replace(/_/g, ' ')}</td>
              <td className="px-2 py-2 text-xs font-medium text-slate-600">{String(r.module ?? r.resource_type ?? '—')}</td>
              <td className="px-2 py-2 text-xs font-medium text-slate-500 max-w-[120px] truncate">{String(r.old_value ?? '—')}</td>
              <td className="px-2 py-2 text-xs font-medium text-slate-800 max-w-[120px] truncate">{String(r.new_value ?? '—')}</td>
              <td className="px-2 py-2 text-xs font-medium text-slate-500">{String(r.reason ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Jobs applied / assigned for Candidate 360 */
export function CandidateJobsPanel({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch(`/api/candidates/${candidateId}/jobs`)
        const data = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (!res.ok) {
            setErr(typeof data.error === 'string' ? data.error : 'Could not load jobs applied')
            setRows([])
          } else {
            setRows(data.jobs ?? data.shares ?? [])
          }
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load jobs applied')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
  }

  if (err) {
    return <p className="px-5 py-8 text-sm font-medium text-rose-600 text-center">{err}</p>
  }

  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">
        This profile is not shared to any client yet. Same CV can go to many clients — that is not a duplicate.
        Open Submissions and pick client + role.
      </p>
    )
  }

  return (
    <div data-testid="jobs-applied-list">
      <p className="px-5 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
        {rows.length} share{rows.length === 1 ? '' : 's'} · one profile
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((j, i) => (
          <li key={String(j.submission_id ?? j.id ?? i)} className="px-5 py-3">
            <p className="text-sm font-extrabold text-slate-900">
              {String(j.title ?? j.applying_for ?? 'Role')}
            </p>
            <p className="text-xs font-medium text-slate-600 mt-0.5">
              Client: {String(j.client ?? j.company ?? j.client_name ?? '—')}
              {j.job_short_id ? ` · ${String(j.job_short_id)}` : ''}
              {j.stage ? ` · ${String(j.stage).replace(/_/g, ' ')}` : j.source === 'assigned' ? ' · assigned, not submitted' : ''}
              {j.submission_short_id ? ` · ${String(j.submission_short_id)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CandidateAttachmentsPanel({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/candidates/${candidateId}/documents`)
        const data = await res.json()
        const docs = (data.documents ?? []) as { slot_label?: string; slot_type?: string; versions?: { file_name?: string; version_no?: number; created_at?: string }[]; id?: string }[]
        const flat: Record<string, unknown>[] = []
        for (const d of docs) {
          for (const v of d.versions ?? []) {
            flat.push({
              slot: d.slot_label || d.slot_type,
              file: v.file_name,
              version: v.version_no,
              at: v.created_at,
              docId: d.id,
            })
          }
        }
        if (!cancelled) setRows(flat)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm font-medium text-slate-500 text-center">No attachments uploaded.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r, i) => (
        <li key={i} className="px-5 py-3 flex items-center gap-3">
          <Paperclip className="w-4 h-4 text-indigo-600" />
          <div>
            <p className="text-sm font-extrabold text-slate-900">{String(r.file ?? 'File')}</p>
            <p className="text-xs font-medium text-slate-600">
              {String(r.slot ?? '')} · v{String(r.version ?? 1)}
              {r.at ? ` · ${new Date(String(r.at)).toLocaleDateString()}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
