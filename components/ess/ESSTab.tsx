'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Calendar, Download, FileText, Loader2, Save, User } from 'lucide-react'

type EssData = {
  user: { name: string; email: string } | null
  profile: {
    emergency_contact: string | null
    emergency_phone: string | null
    address: string | null
    bank_name: string | null
    bank_account_masked: string | null
    id_document_ref: string | null
  } | null
  payslips: { id: string; period_label: string; period_month: string; external_url: string | null }[]
  leave_requests: { id: string; leave_type: string; start_date: string; end_date: string; days: number; status: string; reason: string | null }[]
  company_documents: { id: string; doc_type: string; title: string; external_url: string | null }[]
}

export function ESSTab() {
  const [data, setData] = useState<EssData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'profile' | 'attendance' | 'payslips' | 'leave' | 'docs' | 'mydocs'>('profile')
  const [form, setForm] = useState({ emergency_contact: '', emergency_phone: '', address: '', bank_name: '', bank_account_masked: '', id_document_ref: '' })
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '1', reason: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<{ records: unknown[]; today: { check_in_at?: string; check_out_at?: string } | null } | null>(null)
  const [empDocs, setEmpDocs] = useState<{ id: string; title: string; doc_type: string; external_url: string | null }[]>([])
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ess/profile')
      const d = await res.json()
      setData(d)
      if (typeof d.leave_balance === 'number') setLeaveBalance(d.leave_balance)
      if (d.profile) {
        setForm({
          emergency_contact: d.profile.emergency_contact ?? '',
          emergency_phone: d.profile.emergency_phone ?? '',
          address: d.profile.address ?? '',
          bank_name: d.profile.bank_name ?? '',
          bank_account_masked: d.profile.bank_account_masked ?? '',
          id_document_ref: d.profile.id_document_ref ?? '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (tab === 'attendance') {
      fetch('/api/ess/attendance').then(r => r.json()).then(setAttendance).catch(() => {})
    }
    if (tab === 'mydocs') {
      fetch('/api/ess/documents').then(r => r.json()).then(d => setEmpDocs(d.documents ?? [])).catch(() => {})
    }
  }, [tab])

  const checkInOut = async (action: 'check_in' | 'check_out') => {
    setSaving(true)
    try {
      const res = await fetch('/api/ess/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const d = await fetch('/api/ess/attendance').then(r => r.json())
        setAttendance(d)
        setMsg(action === 'check_in' ? 'Checked in.' : 'Checked out.')
      }
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/ess/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setMsg('Profile saved.')
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        setMsg(err.error ?? 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const applyLeave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/ess/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leaveForm, days: parseFloat(leaveForm.days) }),
      })
      if (res.ok) {
        setMsg('Leave request submitted.')
        setLeaveForm(f => ({ ...f, reason: '' }))
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        setMsg(err.error ?? 'Submit failed')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  const tabs = [
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { key: 'leave' as const, label: 'Leave', icon: Calendar },
    { key: 'payslips' as const, label: 'Payslips', icon: Download },
    { key: 'docs' as const, label: 'Company Docs', icon: FileText },
    { key: 'mydocs' as const, label: 'My Documents', icon: FileText },
  ]

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Building2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">My ESS</h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.user?.name ?? data?.user?.email ?? 'Employee self-service'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-5">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium ${tab === t.key ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-indigo-700 mb-4">{msg}</p>}

      {tab === 'profile' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 max-w-xl space-y-3">
          {(['emergency_contact', 'emergency_phone', 'address', 'bank_name', 'bank_account_masked', 'id_document_ref'] as const).map(k => (
            <div key={k}>
              <label className="text-xs font-bold text-slate-500 uppercase">{k.replace(/_/g, ' ')}</label>
              <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </div>
          ))}
          <button type="button" onClick={saveProfile} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4 max-w-lg">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => checkInOut('check_in')} disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">
              Check In
            </button>
            <button type="button" onClick={() => checkInOut('check_out')} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 disabled:opacity-50">
              Check Out
            </button>
            {attendance?.today && (
              <p className="text-xs text-slate-500 w-full mt-2">
                Today: {attendance.today.check_in_at ? `In ${new Date(attendance.today.check_in_at).toLocaleTimeString()}` : 'Not checked in'}
                {attendance.today.check_out_at ? ` · Out ${new Date(attendance.today.check_out_at).toLocaleTimeString()}` : ''}
              </p>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {((attendance?.records ?? []) as { work_date: string; status: string; check_in_at?: string }[]).map((r, i) => (
              <li key={i} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 bg-white">
                <span>{new Date(r.work_date).toLocaleDateString()}</span>
                <span className="capitalize text-slate-500">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'mydocs' && (
        <ul className="space-y-2 max-w-lg">
          {empDocs.length === 0 ? (
            <p className="text-slate-400 text-sm">No personal documents uploaded.</p>
          ) : empDocs.map(d => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-slate-500 capitalize">{d.doc_type}</p>
              </div>
              {d.external_url && (
                <a href={d.external_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'payslips' && (
        <ul className="space-y-2 max-w-lg">
          {(data?.payslips ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">No payslips available.</p>
          ) : data!.payslips.map(p => (
            <li key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-medium">{p.period_label}</span>
              {p.external_url ? (
                <a href={p.external_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Download</a>
              ) : (
                <a href={`/api/ess/payslips/download?id=${p.id}`} className="text-xs text-indigo-600 hover:underline">Download PDF</a>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'leave' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-md">
            <p className="text-sm font-bold text-slate-900">Apply for leave</p>
            {leaveBalance != null && (
              <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">Annual leave balance: {leaveBalance} days</p>
            )}
            <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
              <option value="annual">Annual</option>
              <option value="medical">Medical</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input type="number" step="0.5" value={leaveForm.days} onChange={e => setLeaveForm(f => ({ ...f, days: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Days" />
            <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
              rows={2} placeholder="Reason (optional)" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <button type="button" onClick={applyLeave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
              Submit request
            </button>
          </div>
          <ul className="space-y-2">
            {(data?.leave_requests ?? []).map(l => (
              <li key={l.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-medium capitalize">{l.leave_type}</span>
                <span className="text-slate-500"> · {l.start_date} → {l.end_date} ({l.days}d)</span>
                <span className={`ml-2 text-xs capitalize px-2 py-0.5 rounded-full ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : l.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{l.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'docs' && (
        <ul className="space-y-2 max-w-lg">
          {(data?.company_documents ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">No company documents shared yet.</p>
          ) : data!.company_documents.map(d => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-slate-500 capitalize">{d.doc_type}</p>
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
