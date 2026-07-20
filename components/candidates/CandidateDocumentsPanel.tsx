'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, Loader2, Upload } from 'lucide-react'

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
}

function fmtSize(n?: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function CandidateDocumentsPanel({ candidateId }: { candidateId: string }) {
  const [docs, setDocs] = useState<DocSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [versionPick, setVersionPick] = useState<Record<string, number>>({})

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
    <div className="p-5 space-y-4 bg-white">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Document slots</p>
      <div className="space-y-3">
        {docs.map(slot => {
          const ver = getVersion(slot)
          const hasFile = !!ver && !!slot.id
          return (
            <div key={slot.slot_type} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{slot.slot_label}</p>
                  {hasFile ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ver!.file_name} · v{ver!.version_no}
                      {ver!.file_size_bytes ? ` · ${fmtSize(ver!.file_size_bytes)}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">No file uploaded</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {slot.versions?.length > 1 && (
                    <select
                      value={versionPick[slot.slot_type] ?? slot.versions[0]?.version_no}
                      onChange={e => setVersionPick(p => ({ ...p, [slot.slot_type]: parseInt(e.target.value, 10) }))}
                      className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1"
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </a>
                      <a
                        href={`/api/candidates/${candidateId}/documents/${slot.id}/download?version=${ver!.version_no}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </>
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
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
  )
}
