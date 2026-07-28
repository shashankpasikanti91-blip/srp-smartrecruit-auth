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
  const [showForm, setShowForm] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', industry: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data.clients ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ name: '', industry: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' })
      load()
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
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
            <Plus className="w-4 h-4" /> Add Client
          </button>
          <button
            type="button"
            onClick={() => exportCsv(
              'clients.csv',
              ['Name', 'Industry', 'Contact', 'Email', 'Phone', 'Notes'],
              clients.map(c => [c.name, c.industry, c.contact_name, c.contact_email, c.contact_phone, c.notes]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <input placeholder="Client name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" />
          <input placeholder="Contact phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="px-3 py-2 rounded-lg border text-sm sm:col-span-2" />
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={create} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
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
                <th>Email</th>
                <th>Phone</th>
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
                  <td>{c.contact_email || '—'}</td>
                  <td>{c.contact_phone || '—'}</td>
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
        />
      )}
    </div>
  )
}
