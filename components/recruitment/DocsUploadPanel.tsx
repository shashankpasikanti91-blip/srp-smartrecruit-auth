'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'

const DOCUMENT_SLOTS = [
  'resume',
  'passport',
  'visa',
  'certificate',
  'offer_letter',
  'experience_letter',
  'other',
] as const

type DocumentSlot = (typeof DOCUMENT_SLOTS)[number]

const SLOT_LABELS: Record<DocumentSlot, string> = {
  resume: 'Resume / CV',
  passport: 'Passport',
  visa: 'Visa / Work Permit',
  certificate: 'Certificates',
  offer_letter: 'Offer Letter',
  experience_letter: 'Experience Letter',
  other: 'Other',
}

type SlotRow = {
  id: string | null
  slot_type: string
  slot_label?: string
  empty?: boolean
  versions?: { id: string; file_name: string; version_no: number }[]
}

export function DocsUploadPanel({
  resumeId,
  candidateName,
  onClose,
  onUploaded,
}: {
  resumeId: string
  candidateName?: string
  onClose: () => void
  onUploaded?: () => void
}) {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/candidates/${resumeId}/documents`)
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
  }, [resumeId])

  useEffect(() => { load() }, [load])

  const upload = async (slot: DocumentSlot, file: File) => {
    setUploading(slot)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('slot_type', slot)
      const res = await fetch(`/api/candidates/${resumeId}/documents`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
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
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3">
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
          {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            DOCUMENT_SLOTS.map(slot => {
              const row = slots.find(s => s.slot_type === slot)
              const latest = row?.versions?.[0]
              const busy = uploading === slot
              return (
                <div key={slot} className="rounded-xl border border-slate-200 px-3 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">{SLOT_LABELS[slot]}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {latest ? `${latest.file_name} · v${latest.version_no}` : 'No file uploaded'}
                    </p>
                  </div>
                  <input
                    ref={el => { inputRefs.current[slot] = el }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) upload(slot, f)
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRefs.current[slot]?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {latest ? 'Replace' : 'Upload'}
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
