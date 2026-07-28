'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'
import { InnerBlock, SectionPanel } from '@/components/ui/SectionPanel'
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  type NoteCategory,
  type NoteEntityType,
} from '@/lib/noteConstants'

type NoteRow = {
  id: string
  category: NoteCategory
  body: string
  author_email?: string | null
  author_name?: string | null
  created_at: string
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const CATEGORY_BADGE: Record<NoteCategory, string> = {
  recruiter: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  follow_up: 'bg-amber-50 text-amber-900 border-amber-200',
  internal: 'bg-slate-100 text-slate-800 border-slate-300',
  reviewer: 'bg-violet-50 text-violet-800 border-violet-200',
  client_feedback: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  general: 'bg-sky-50 text-sky-800 border-sky-200',
}

export function EntityNotesTimeline({
  entityType,
  entityId,
  title = 'Notes',
  subtitle = 'Append notes over time — each entry keeps author and timestamp.',
  defaultCategory = 'recruiter',
  allowedCategories,
}: {
  entityType: NoteEntityType
  entityId: string
  title?: string
  subtitle?: string
  defaultCategory?: NoteCategory
  allowedCategories?: NoteCategory[]
}) {
  const cats = allowedCategories?.length
    ? allowedCategories
    : ([...NOTE_CATEGORIES] as NoteCategory[])

  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<NoteCategory>(
    cats.includes(defaultCategory) ? defaultCategory : cats[0],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entityType, entityId, limit: '80' })
      const res = await fetch(`/api/notes?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load notes')
        return
      }
      setNotes(data.notes ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  const addNote = async () => {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, category, body: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save note')
        return
      }
      setBody('')
      setMsg('Note added.')
      setNotes(prev => [data.note, ...prev])
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const removeNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, action: 'delete' }),
      })
      if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch { /* ignore */ }
  }

  return (
    <SectionPanel title={title} subtitle={subtitle}>
      <InnerBlock title="Add note" className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          <select
            value={category}
            onChange={e => setCategory(e.target.value as NoteCategory)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {cats.map(c => (
              <option key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="Write a note for the team…"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={addNote}
            disabled={saving || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
            Add note
          </button>
          {msg && <span className="text-xs text-emerald-600 font-medium">{msg}</span>}
          {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
        </div>
      </InnerBlock>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No notes yet — add the first entry above.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map(n => (
            <li
              key={n.id}
              className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[n.category] ?? CATEGORY_BADGE.general}`}>
                    {NOTE_CATEGORY_LABELS[n.category] ?? n.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {n.author_name || n.author_email || 'Unknown'}
                  </span>
                  <span className="text-[11px] text-slate-400">{fmtWhen(n.created_at)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeNote(n.id)}
                  className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  )
}
