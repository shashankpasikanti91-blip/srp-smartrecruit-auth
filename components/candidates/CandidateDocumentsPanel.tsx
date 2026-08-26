'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Download, Eye, Loader2, RotateCcw, Upload, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { CHECKLIST_COUNTRIES, type EmploymentType } from '@/lib/recruitmentOs'

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
  required?: boolean
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
  const [fileOk, setFileOk] = useState<Record<string, boolean | null>>({})
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [country, setCountry] = useState('MY')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('local')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const hydrated = useRef(false)

  const load = useCallback(async (c?: string, emp?: EmploymentType) => {
    setLoading(true)
    setError(null)
    try {
      const useC = c ?? country
      const useEmp = emp ?? employmentType
      const params = new URLSearchParams({ country: useC, employment_type: useEmp })
      const res = await fetch(`/api/candidates/${candidateId}/documents?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load documents')
        return
      }
      setDocs(data.documents ?? [])
      if (!hydrated.current) {
        if (typeof data.country === 'string' && data.country) setCountry(data.country)
        if (data.employment_type === 'foreign' || data.employment_type === 'local') {
          setEmploymentType(data.employment_type)
        }
        hydrated.current = true
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [candidateId, country, employmentType])

  useEffect(() => { load() }, [load])
  useEffect(() => { hydrated.current = false }, [candidateId])

  const probeVersion = useCallback(async (slotId: string, versionNo: number) => {
    const key = `${slotId}:${versionNo}`
    setFileOk(prev => ({ ...prev, [key]: null }))
    try {
      const res = await fetch(
        `/api/candidates/${candidateId}/documents/${slotId}/download?version=${versionNo}`,
        { method: 'HEAD' },
      )
      const ok = res.ok
      setFileOk(prev => ({ ...prev, [key]: ok }))
      return ok
    } catch {
      setFileOk(prev => ({ ...prev, [key]: false }))
      return false
    }
  }, [candidateId])

  const uploadMany = async (slotType: string, files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(slotType)
    setError(null)
    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('slot_type', slotType)
        const res = await fetch(`/api/candidates/${candidateId}/documents`, { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? `Upload failed for ${file.name}`)
          break
        }
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
      <p className="text-xs text-slate-500 -mt-1">
        Switch Local / Expat to load the mapped checklist. Drag and drop files onto a slot.
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="text-[10px] font-extrabold uppercase text-slate-600">
          Country
          <select
            data-testid="docs-country"
            value={country}
            onChange={e => {
              const v = e.target.value
              setCountry(v)
              void load(v, employmentType)
            }}
            className="mt-1 block text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 py-1.5"
          >
            {CHECKLIST_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-extrabold uppercase text-slate-600">
          Employment
          <select
            data-testid="docs-employment-type"
            value={employmentType}
            onChange={e => {
              const v = e.target.value as EmploymentType
              setEmploymentType(v)
              void load(country, v)
            }}
            className="mt-1 block text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 py-1.5"
          >
            <option value="local">Local</option>
            <option value="foreign">Expat (foreign)</option>
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {docs.map(slot => {
          const ver = getVersion(slot)
          const hasFile = !!ver && !!slot.id
          const vst = slot.verification_status || (hasFile ? 'pending_verification' : null)
          const required = !!slot.required
          const probeKey = hasFile && slot.id ? `${slot.id}:${ver!.version_no}` : ''
          const okState = probeKey ? fileOk[probeKey] : undefined
          return (
            <div
              key={slot.slot_type}
              data-testid={`doc-slot-${slot.slot_type}`}
              onDragOver={e => { e.preventDefault(); setDragOver(slot.slot_type) }}
              onDragLeave={() => setDragOver(cur => cur === slot.slot_type ? null : cur)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(null)
                if (e.dataTransfer.files?.length) void uploadMany(slot.slot_type, e.dataTransfer.files)
              }}
              className={`rounded-xl border bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02] ${
                dragOver === slot.slot_type ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200/90'
              }`}
            >
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
                      {slot.versions.length > 1 ? ` · ${slot.versions.length} files` : ''}
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
                        <option key={v.id} value={v.version_no}>v{v.version_no} · {v.file_name}</option>
                      ))}
                    </select>
                  )}
                  {hasFile && slot.id && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await probeVersion(slot.id!, ver!.version_no)
                          if (ok) {
                            setPreviewKey(`${slot.id}:${ver!.version_no}`)
                            window.open(
                              `/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver!.version_no}&inline=1`,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                      <a
                        href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver!.version_no}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                        onClick={async e => {
                          const ok = await probeVersion(slot.id!, ver!.version_no)
                          if (!ok) {
                            e.preventDefault()
                          }
                        }}
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
                    {hasFile ? 'Add file(s)' : 'Upload'}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={e => {
                        if (e.target.files?.length) uploadMany(slot.slot_type, e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>

              {hasFile && slot.versions.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                  {slot.versions.map(v => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                      <span className="truncate">
                        <span className="font-extrabold text-slate-800">v{v.version_no}</span>
                        {' · '}{v.file_name}
                        {v.file_size_bytes ? ` · ${fmtSize(v.file_size_bytes)}` : ''}
                      </span>
                      <span className="flex gap-1">
                        <a
                          href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${v.version_no}&inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 font-bold hover:underline"
                          onClick={async e => {
                            const ok = await probeVersion(slot.id!, v.version_no)
                            if (!ok) e.preventDefault()
                          }}
                        >
                          Preview
                        </a>
                        <a
                          href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${v.version_no}`}
                          className="text-slate-700 font-bold hover:underline"
                        >
                          Download
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {hasFile && okState === false && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">File missing on server</p>
                    <p className="mt-0.5 text-amber-900/90">
                      The database has a record, but the file is not on disk. Use <strong>Add file(s)</strong> to re-upload — do not open Preview (that shows a JSON error in the browser).
                    </p>
                  </div>
                </div>
              )}

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

              {hasFile && ver && slot.id && okState === true && previewKey === `${slot.id}:${ver.version_no}` && (ver.mime_type?.includes('pdf') || ver.file_name.toLowerCase().endsWith('.pdf')) && (
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
