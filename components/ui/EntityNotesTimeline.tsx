'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, MessageSquarePlus, Trash2, Pin, PinOff, Pencil, Search, Lock, Users,
} from 'lucide-react'
import { InnerBlock, SectionPanel } from '@/components/ui/SectionPanel'
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  NOTE_VISIBILITY,
  NOTE_VISIBILITY_LABELS,
  type NoteCategory,
  type NoteEntityType,
  type NoteVisibility,
} from '@/lib/noteConstants'

type NoteRow = {
  id: string
  category: NoteCategory
  body: string
  author_email?: string | null
  author_name?: string | null
  created_at: string
  edited_at?: string | null
  is_pinned?: boolean
  visibility?: NoteVisibility
  mentions?: string[] | null
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
  const [visibility, setVisibility] = useState<NoteVisibility>('team')
  const [pinOnCreate, setPinOnCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filterVis, setFilterVis] = useState<'' | NoteVisibility>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editCategory, setEditCategory] = useState<NoteCategory>('general')
  const [editVisibility, setEditVisibility] = useState<NoteVisibility>('team')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entityType, entityId, limit: '80' })
      if (search.trim()) params.set('q', search.trim())
      if (filterVis) params.set('visibility', filterVis)
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
  }, [entityType, entityId, search, filterVis])

  useEffect(() => { load() }, [load])

  const addNote = async () => {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      const mentions = Array.from(text.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)).map(m => m[1])
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          category,
          body: text,
          visibility,
          is_pinned: pinOnCreate,
          mentions,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save note')
        return
      }
      setBody('')
      setPinOnCreate(false)
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

  const togglePin = async (note: NoteRow) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id, action: 'pin', is_pinned: !note.is_pinned }),
      })
      if (res.ok) {
        setNotes(prev => {
          const next = prev.map(n => n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n)
          return next.sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned))
        })
      }
    } catch { /* ignore */ }
  }

  const startEdit = (note: NoteRow) => {
    setEditingId(note.id)
    setEditBody(note.body)
    setEditCategory(note.category)
    setEditVisibility(note.visibility === 'private' ? 'private' : 'team')
  }

  const saveEdit = async () => {
    if (!editingId || !editBody.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: editingId,
          action: 'edit',
          body: editBody.trim(),
          category: editCategory,
          visibility: editVisibility,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not edit note')
        return
      }
      setNotes(prev => prev.map(n => n.id === editingId ? { ...n, ...data.note } : n))
      setEditingId(null)
      setMsg('Note updated.')
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionPanel title={title} subtitle={subtitle}>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterVis}
          onChange={e => setFilterVis(e.target.value as '' | NoteVisibility)}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
        >
          <option value="">All visibility</option>
          {NOTE_VISIBILITY.map(v => (
            <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>
          ))}
        </select>
      </div>

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
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value as NoteVisibility)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {NOTE_VISIBILITY.map(v => (
              <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer">
            <input type="checkbox" checked={pinOnCreate} onChange={e => setPinOnCreate(e.target.checked)} className="rounded border-slate-300" />
            Pin
          </label>
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="Write a note… Use @email@domain.com to mention a recruiter."
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
              className={`rounded-xl border bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02] ${
                n.is_pinned ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  {n.is_pinned && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-900">
                      Pinned
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[n.category] ?? CATEGORY_BADGE.general}`}>
                    {NOTE_CATEGORY_LABELS[n.category] ?? n.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                    {n.visibility === 'private' ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {n.visibility === 'private' ? 'Private' : 'Team'}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {n.author_name || n.author_email || 'Unknown'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {fmtWhen(n.created_at)}
                    {n.edited_at ? ' · edited' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => togglePin(n)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50" title={n.is_pinned ? 'Unpin' : 'Pin'}>
                    {n.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => startEdit(n)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => removeNote(n.id)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {editingId === n.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value as NoteCategory)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
                      {cats.map(c => <option key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <select value={editVisibility} onChange={e => setEditVisibility(e.target.value as NoteVisibility)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
                      {NOTE_VISIBILITY.map(v => <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  )
}
