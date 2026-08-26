'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import {
  CHECKLIST_COUNTRIES,
  type EmploymentType,
} from '@/lib/recruitmentOs'

type SlotRow = {
  id: string | null
  slot_type: string
  slot_label?: string
  empty?: boolean
  required?: boolean
  versions?: { id: string; file_name: string; version_no: number }[]
}

export function DocsUploadPanel({
  resumeId,
  candidateName,
  onClose,
  onUploaded,
  offerId,
  country: countryProp,
  employmentType: employmentProp,
  onMetaChange,
}: {
  resumeId: string
  candidateName?: string
  onClose: () => void
  onUploaded?: () => void
  offerId?: string
  country?: string
  employmentType?: EmploymentType
  onMetaChange?: (country: string, employmentType: EmploymentType) => void
}) {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [country, setCountry] = useState(countryProp || 'MY')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employmentProp || 'local')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (countryProp) setCountry(countryProp)
  }, [countryProp])
  useEffect(() => {
    if (employmentProp) setEmploymentType(employmentProp)
  }, [employmentProp])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ country, employment_type: employmentType })
      const res = await fetch(`/api/candidates/${resumeId}/documents?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load documents')
        setSlots([])
        return
      }
      setSlots((data.documents ?? []) as SlotRow[])
    } catch {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [resumeId, country, employmentType])

  useEffect(() => { load() }, [load])

  const persistMeta = (nextCountry: string, nextEmp: EmploymentType) => {
    onMetaChange?.(nextCountry, nextEmp)
    if (offerId) {
      void fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: nextCountry, employment_type: nextEmp }),
      })
    }
  }

  const uploadMany = async (slot: string, files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(slot)
    setError('')
    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('slot_type', slot)
        const res = await fetch(`/api/candidates/${resumeId}/documents`, {
          method: 'POST',
          body: fd,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? `Upload failed for ${file.name}`)
          break
        }
      }
      await load()
      onUploaded?.()
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Documents</p>
            <h2 className="page-title text-lg">Upload docs</h2>
            {candidateName ? <p className="text-sm font-bold text-slate-700 mt-0.5">{candidateName}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="text-[10px] font-extrabold uppercase text-slate-600">
              Country
              <select
                data-testid="docs-country"
                value={country}
                onChange={e => {
                  const v = e.target.value
                  setCountry(v)
                  persistMeta(v, employmentType)
                }}
                className="mt-1 block form-input !py-1.5 !text-sm appearance-none"
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
                  persistMeta(country, v)
                }}
                className="mt-1 block form-input !py-1.5 !text-sm appearance-none"
              >
                <option value="local">Local</option>
                <option value="foreign">Expat (foreign)</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">Drag and drop files onto a slot, or click Upload. Switching Local / Expat reloads the checklist.</p>
          {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500">No documents mapped for this country / employment type.</p>
          ) : (
            slots.map(row => {
              const slot = row.slot_type
              const latest = row.versions?.[0]
              const busy = uploading === slot
              const over = dragOver === slot
              return (
                <div
                  key={slot}
                  data-testid={`doc-slot-${slot}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(slot) }}
                  onDragLeave={() => setDragOver(cur => cur === slot ? null : cur)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOver(null)
                    if (e.dataTransfer.files?.length) void uploadMany(slot, e.dataTransfer.files)
                  }}
                  className={`rounded-xl border px-3 py-3 flex items-center gap-3 ${
                    over ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">
                      {row.slot_label || slot}
                      {row.required ? (
                        <span className="ml-2 text-[10px] font-extrabold uppercase text-rose-700">Required</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {latest ? `${latest.file_name} · v${latest.version_no}` : 'No file — drop here or upload'}
                    </p>
                  </div>
                  <input
                    ref={el => { inputRefs.current[slot] = el }}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={e => {
                      const files = e.target.files
                      e.target.value = ''
                      if (files?.length) uploadMany(slot, files)
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRefs.current[slot]?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {latest ? 'Add file(s)' : 'Upload'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
