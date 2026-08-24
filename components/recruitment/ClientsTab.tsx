'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Download, Loader2, Plus, RefreshCw } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { exportCsv } from '@/lib/exportCsv'
import { Client360View } from '@/components/recruitment/Client360View'
import { DeleteActionButton } from '@/components/recruitment/DeleteActionButton'

type Client = {
  id: string
  name: string
  industry: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  hiring_manager?: string | null
  country_code?: string | null
}

const EMPTY_FORM = {
  name: '',
  industry: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
  hiring_manager: '',
  country_code: '',
}

export function ClientsTab({
  canDirectDelete = false,
  canRequestDelete = true,
}: {
  canDirectDelete?: boolean
  canRequestDelete?: boolean
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/clients')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error || `Could not load clients (${res.status})`)
        return
      }
      setClients(Array.isArray(data.clients) ? data.clients : [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Network error loading clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) {
      setSaveError('Client name is required')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || `Save failed (${res.status})`)
        return
      }
      const created = data.client as Client | undefined
      if (created?.id) {
        setClients(prev => [created, ...prev.filter(c => c.id !== created.id)])
      } else {
        await load()
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      if (created?.id) setSelectedClientId(created.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error — could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Building2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-lg sm:text-xl">Clients</h1>
            <p className="text-sm text-slate-500 mt-0.5">{clients.length} active clients</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowForm(true); setSaveError('') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
          <button
            type="button"
            onClick={() => exportCsv(
              'clients.csv',
              ['Name', 'Industry', 'Contact', 'Phone', 'Email', 'Notes'],
              clients.map(c => [c.name, c.industry, c.contact_name, c.contact_phone, c.contact_email, c.notes]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button type="button" onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium">
          {loadError}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <input placeholder="Client name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Hiring manager" value={form.hiring_manager} onChange={e => setForm(f => ({ ...f, hiring_manager: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Country code (e.g. MY, IN)" value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" />
          {saveError && (
            <p className="sm:col-span-2 text-sm text-red-700 font-medium">{saveError}</p>
          )}
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Client'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setSaveError('') }}
              disabled={saving}
              className="px-4 py-2 rounded-lg border text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Industry</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No clients yet</td></tr>
              ) : clients.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
                >
                  <td className="font-medium">{c.name}</td>
                  <td>{c.industry || '—'}</td>
                  <td>{c.contact_name || '—'}</td>
                  <td>{c.contact_phone || '—'}</td>
                  <td>{c.contact_email || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {canRequestDelete ? (
                      <DeleteActionButton
                        resourceType="client"
                        resourceId={c.id}
                        resourceLabel={c.name}
                        canDirectDelete={canDirectDelete}
                        onDone={({ direct }) => {
                          if (direct) setClients(prev => prev.filter(x => x.id !== c.id))
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {selectedClientId && (
        <Client360View
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onSaved={(updated) => {
            setClients(prev => prev.map(c => (c.id === updated.id ? { ...c, ...updated } : c)))
          }}
        />
      )}
    </div>
  )
}
