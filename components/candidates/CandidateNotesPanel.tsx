'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'

export function CandidateNotesPanel({
  candidateId,
  notes,
  followUpNotes,
  internalComments,
  reviewerNotes,
  onSaved,
}: {
  candidateId: string
  notes?: string | null
  followUpNotes?: string | null
  internalComments?: string | null
  reviewerNotes?: string | null
  onSaved?: (profile: Record<string, string | null>) => void
}) {
  const [form, setForm] = useState({
    notes: notes ?? '',
    follow_up_notes: followUpNotes ?? '',
    internal_comments: internalComments ?? '',
    reviewer_notes: reviewerNotes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_notes: form.reviewer_notes.trim() || null,
          candidate_profile: {
            notes: form.notes.trim() || null,
            follow_up_notes: form.follow_up_notes.trim() || null,
            internal_comments: form.internal_comments.trim() || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error ?? 'Save failed')
        return
      }
      setMsg('Notes saved.')
      onSaved?.(data.candidate?.candidate_profile ?? {})
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form, label: string, rows = 3) => (
    <div>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
      <textarea
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        rows={rows}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      />
    </div>
  )

  return (
    <div className="p-5 bg-white space-y-4">
      {field('notes', 'Recruiter notes')}
      {field('follow_up_notes', 'Follow-up notes')}
      {field('internal_comments', 'Internal comments')}
      {field('reviewer_notes', 'Reviewer notes', 2)}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save notes
        </button>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </div>
    </div>
  )
}
