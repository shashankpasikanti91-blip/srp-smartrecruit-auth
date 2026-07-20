'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, Plus } from 'lucide-react'

type Doc = { id: string; doc_type: string; title: string; external_url: string | null; visible_to_all: boolean; created_at: string }

export function DocumentsRegistryTab() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', doc_type: 'policy', external_url: '', visible_to_all: true })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ess/admin/company-docs')
      if (res.ok) {
        const data = await res.json()
        setDocs(data.documents ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!form.title.trim()) return
    const res = await fetch('/api/ess/admin/company-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ title: '', doc_type: 'policy', external_url: '', visible_to_all: true })
      load()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'Upload failed — admin access required')
    }
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Company Documents</h1>
            <p className="text-sm text-slate-500 mt-0.5">HR document registry (visible in ESS)</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 grid sm:grid-cols-2 gap-3">
        <input placeholder="Document title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
        <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm">
          <option value="policy">Policy</option>
          <option value="handbook">Handbook</option>
          <option value="form">Form</option>
          <option value="announcement">Announcement</option>
        </select>
        <input placeholder="External URL" value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" />
        <button onClick={add} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold sm:col-span-2 w-fit">
          <Plus className="w-4 h-4" /> Add document
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <ul className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">No company documents registered.</p>
          ) : docs.map(d => (
            <li key={d.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{d.title}</p>
                <p className="text-xs text-slate-500 capitalize">{d.doc_type} · {d.visible_to_all ? 'All staff' : 'Specific user'}</p>
              </div>
              {d.external_url && (
                <a href={d.external_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
