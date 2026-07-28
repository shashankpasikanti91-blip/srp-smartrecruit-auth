'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Download, Eye, Loader2, RotateCcw, Upload, XCircle, Clock } from 'lucide-react'

type DocVersion = {
  id: string
  version_no: number
  file_name: string
  mime_type?: string | null
  file_size_bytes?: number | null
  created_at?: string
}

type DocSlot = {
  id: string | null
  slot_type: string
  slot_label: string
  label?: string
  versions: DocVersion[]
  empty?: boolean
  verification_status?: string | null
  verified_by?: string | null
  verified_at?: string | null
  expiry_date?: string | null
}

type HistRow = {
  id: string
  user_email?: string | null
  old_status?: string | null
  new_status?: string
  notes?: string | null
  created_at?: string
}

function fmtSize(n?: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function statusStyle(s?: string | null) {
  const v = (s || 'pending_verification').toLowerCase()
  const map: Record<string, string> = {
    pending_verification: 'bg-amber-50 text-amber-900 border-amber-200',
    verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
    expired: 'bg-slate-100 text-slate-700 border-slate-300',
    replacement_requested: 'bg-violet-50 text-violet-800 border-violet-200',
    unverified: 'bg-amber-50 text-amber-900 border-amber-200',
  }
  return map[v] ?? 'bg-slate-50 text-slate-700 border-slate-200'
}

export function CandidateDocumentsPanel({ candidateId }: { candidateId: string }) {
  const [docs, setDocs] = useState<DocSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [versionPick, setVersionPick] = useState<Record<string, number>>({})
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<Record<string, HistRow[]>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/documents`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load documents')
        return
      }
      setDocs(data.documents ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => { load() }, [load])

  const upload = async (slotType: string, file: File) => {
    setUploading(slotType)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('slot_type', slotType)
      const res = await fetch(`/api/candidates/${candidateId}/documents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
      }
      await load()
    } finally {
      setUploading(null)
    }
  }

  const verify = async (docId: string, status: string) => {
    setActing(docId + status)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: noteDraft[docId] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification update failed')
        return
      }
      if (data.history) setHistory(h => ({ ...h, [docId]: data.history }))
      setNoteDraft(n => ({ ...n, [docId]: '' }))
      await load()
    } finally {
      setActing(null)
    }
  }

  const loadHistory = async (docId: string) => {
    const res = await fetch(`/api/candidates/${candidateId}/documents/${docId}`)
    const data = await res.json()
    setHistory(h => ({ ...h, [docId]: data.history ?? [] }))
  }

  const getVersion = (slot: DocSlot): DocVersion | null => {
    if (!slot.versions?.length) return null
    const pick = versionPick[slot.slot_type]
    return slot.versions.find(v => v.version_no === pick) ?? slot.versions[0]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading documents…
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/40">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 font-bold">{error}</div>
      )}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.02] p-4 sm:p-5 space-y-3">
      <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest">Document Center</p>
      <p className="text-xs text-slate-500 -mt-1">Slots follow country checklist when nationality is set. Required items are marked.</p>
      <div className="space-y-3">
        {docs.map(slot => {
          const ver = getVersion(slot)
          const hasFile = !!ver && !!slot.id
          const vst = slot.verification_status || (hasFile ? 'pending_verification' : null)
          const required = !!(slot as DocSlot & { required?: boolean }).required
          return (
            <div key={slot.slot_type} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-extrabold text-slate-900">{slot.slot_label}</p>
                    {required && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border bg-rose-50 text-rose-800 border-rose-200">
                        Required
                      </span>
                    )}
                    {vst && (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${statusStyle(vst)}`}>
                        {vst.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {hasFile ? (
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {ver!.file_name} · v{ver!.version_no}
                      {ver!.file_size_bytes ? ` · ${fmtSize(ver!.file_size_bytes)}` : ''}
                      {slot.verified_at ? ` · Verified ${new Date(slot.verified_at).toLocaleString()}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-slate-400 mt-0.5">No file uploaded</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {slot.versions?.length > 1 && (
                    <select
                      value={versionPick[slot.slot_type] ?? slot.versions[0]?.version_no}
                      onChange={e => setVersionPick(p => ({ ...p, [slot.slot_type]: parseInt(e.target.value, 10) }))}
                      className="text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 py-1"
                    >
                      {slot.versions.map(v => (
                        <option key={v.id} value={v.version_no}>v{v.version_no}</option>
                      ))}
                    </select>
                  )}
                  {hasFile && slot.id && (
                    <>
                      <a
                        href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver!.version_no}&inline=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </a>
                      <a
                        href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver!.version_no}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </>
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                    {uploading === slot.slot_type ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {hasFile ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) upload(slot.slot_type, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>

              {hasFile && slot.id && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <input
                    className="w-full text-xs font-medium rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white"
                    placeholder="Verification notes (required for reject / replacement)"
                    value={noteDraft[slot.id] ?? ''}
                    onChange={e => setNoteDraft(n => ({ ...n, [slot.id!]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={!!acting}
                      onClick={() => verify(slot.id!, 'verified')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 disabled:opacity-50">
                      <Check className="w-3 h-3" /> Verify
                    </button>
                    <button type="button" disabled={!!acting}
                      onClick={() => verify(slot.id!, 'rejected')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-rose-800 bg-rose-50 border border-rose-200 disabled:opacity-50">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                    <button type="button" disabled={!!acting}
                      onClick={() => verify(slot.id!, 'replacement_requested')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-violet-800 bg-violet-50 border border-violet-200 disabled:opacity-50">
                      <RotateCcw className="w-3 h-3" /> Request replacement
                    </button>
                    <button type="button" disabled={!!acting}
                      onClick={() => verify(slot.id!, 'expired')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-300 disabled:opacity-50">
                      <Clock className="w-3 h-3" /> Mark expired
                    </button>
                    <button type="button" onClick={() => loadHistory(slot.id!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100">
                      History
                    </button>
                  </div>
                  {(history[slot.id] ?? []).length > 0 && (
                    <ul className="text-[11px] space-y-1 max-h-28 overflow-y-auto">
                      {history[slot.id].map(h => (
                        <li key={h.id} className="font-medium text-slate-600">
                          <span className="font-extrabold text-slate-800">{h.new_status?.replace(/_/g, ' ')}</span>
                          {h.user_email ? ` · ${h.user_email}` : ''}
                          {h.created_at ? ` · ${new Date(h.created_at).toLocaleString()}` : ''}
                          {h.notes ? ` — ${h.notes}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {hasFile && ver?.mime_type?.includes('pdf') && slot.id && (
                <iframe
                  title={`${slot.slot_label} preview`}
                  src={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver.version_no}&inline=1`}
                  className="mt-3 w-full h-64 rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
