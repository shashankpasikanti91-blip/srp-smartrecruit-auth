'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Receipt,
  Save,
  ScrollText,
  User,
  Wallet,
} from 'lucide-react'

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
  leave_requests: {
    id: string
    leave_type: string
    start_date: string
    end_date: string
    days: number
    status: string
    reason: string | null
  }[]
  company_documents: { id: string; doc_type: string; title: string; external_url: string | null }[]
}

type ClaimRow = {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
}

type AttendanceRecord = {
  work_date: string
  status: string
  check_in_at?: string
  check_out_at?: string
}

type EssView =
  | 'home'
  | 'profile'
  | 'leave'
  | 'attendance'
  | 'payslips'
  | 'docs'
  | 'claims'
  | 'statutory'

const LEAVE_TYPES = [
  { key: 'annual', label: 'Annual leave', accent: '#3B82C4' },
  { key: 'medical', label: 'Medical leave', accent: '#64748B' },
  { key: 'unpaid', label: 'Unpaid leave', accent: '#94A3B8' },
  { key: 'hospitalization', label: 'Hospitalization', accent: '#EF4444' },
  { key: 'compassionate', label: 'Compassionate', accent: '#22C55E' },
] as const

const STATUTORY_TYPES = ['all', 'ea', 'cp22', 'pcb', 'statutory', 'tax'] as const

function statusBadge(status: string) {
  const s = status.toLowerCase()
  if (s.includes('approved') || s === 'resolved' || s === 'present') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  }
  if (s.includes('reject') || s === 'absent' || s === 'cancelled') {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (s.includes('pending') || s === 'in_progress') {
    return 'bg-amber-50 text-amber-900 border-amber-200'
  }
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function monthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function ESSTab() {
  const [data, setData] = useState<EssData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<EssView>('home')
  const [profileSection, setProfileSection] = useState<'basic' | 'emergency' | 'bank'>('basic')
  const [form, setForm] = useState({
    emergency_contact: '',
    emergency_phone: '',
    address: '',
    bank_name: '',
    bank_account_masked: '',
    id_document_ref: '',
  })
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    days: '1',
    reason: '',
  })
  const [claimForm, setClaimForm] = useState({
    claim_type: 'travel',
    title: '',
    claim_date: '',
    amount: '',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<{
    records: AttendanceRecord[]
    today: { check_in_at?: string; check_out_at?: string } | null
  } | null>(null)
  const [empDocs, setEmpDocs] = useState<{ id: string; title: string; doc_type: string; external_url: string | null }[]>([])
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)
  const [leaveFilter, setLeaveFilter] = useState('all')
  const [payslipYear, setPayslipYear] = useState(String(new Date().getFullYear()))
  const [payslipMonth, setPayslipMonth] = useState('all')
  const [attYear, setAttYear] = useState(new Date().getFullYear())
  const [attMonth, setAttMonth] = useState(new Date().getMonth())
  const [statType, setStatType] = useState<(typeof STATUTORY_TYPES)[number]>('all')
  const [statYear, setStatYear] = useState(String(new Date().getFullYear()))
  const [claimStatusFilter, setClaimStatusFilter] = useState('all')

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
    if (view === 'attendance' || view === 'home') {
      const month = `${attYear}-${String(attMonth + 1).padStart(2, '0')}`
      fetch(`/api/ess/attendance?month=${month}`)
        .then(r => r.json())
        .then(setAttendance)
        .catch(() => {})
    }
    if (view === 'docs' || view === 'home') {
      fetch('/api/ess/documents').then(r => r.json()).then(d => setEmpDocs(d.documents ?? [])).catch(() => {})
    }
    if (view === 'claims' || view === 'home') {
      fetch('/api/ess/claims').then(r => r.json()).then(d => setClaims(d.claims ?? [])).catch(() => setClaims([]))
    }
  }, [view, attYear, attMonth])

  const checkInOut = async (action: 'check_in' | 'check_out') => {
    setSaving(true)
    try {
      const res = await fetch('/api/ess/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const month = `${attYear}-${String(attMonth + 1).padStart(2, '0')}`
        const d = await fetch(`/api/ess/attendance?month=${month}`).then(r => r.json())
        setAttendance(d)
        setMsg(action === 'check_in' ? 'Checked in successfully.' : 'Checked out successfully.')
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

  const submitClaim = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/ess/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...claimForm,
          title: claimForm.title || `${claimForm.claim_type} claim`,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg('Claim submitted for approval.')
        setClaimForm({ claim_type: 'travel', title: '', claim_date: '', amount: '', remarks: '' })
        setClaims(prev => (d.claim ? [d.claim, ...prev] : prev))
      } else {
        setMsg(d.error ?? 'Claim submit failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const leavePending = (data?.leave_requests ?? []).filter(l => l.status === 'pending').length
  const claimsPending = claims.filter(c => c.status === 'pending' || c.status === 'in_progress').length
  const checkedIn = Boolean(attendance?.today?.check_in_at && !attendance?.today?.check_out_at)

  const filteredLeaves = useMemo(() => {
    const rows = data?.leave_requests ?? []
    if (leaveFilter === 'all') return rows
    return rows.filter(l => l.status === leaveFilter)
  }, [data?.leave_requests, leaveFilter])

  const filteredPayslips = useMemo(() => {
    const rows = data?.payslips ?? []
    return rows.filter(p => {
      const d = p.period_month ? new Date(p.period_month) : null
      if (!d || Number.isNaN(d.getTime())) return true
      if (String(d.getFullYear()) !== payslipYear) return false
      if (payslipMonth !== 'all' && d.getMonth() + 1 !== Number(payslipMonth)) return false
      return true
    })
  }, [data?.payslips, payslipYear, payslipMonth])

  const statutoryDocs = useMemo(() => {
    const rows = data?.company_documents ?? []
    return rows.filter(d => {
      const t = `${d.doc_type} ${d.title}`.toLowerCase()
      const isStat =
        t.includes('statutory') ||
        t.includes('form ea') ||
        t.includes(' ea ') ||
        t.startsWith('ea') ||
        t.includes('cp22') ||
        t.includes('pcb') ||
        t.includes('tax') ||
        t.includes('epf') ||
        t.includes('socso') ||
        t.includes('hrdf')
      if (!isStat) return false
      if (statType === 'all') return true
      return t.includes(statType)
    })
  }, [data?.company_documents, statType])

  const filteredClaims = useMemo(() => {
    if (claimStatusFilter === 'all') return claims
    return claims.filter(c => c.status === claimStatusFilter)
  }, [claims, claimStatusFilter])

  const attendanceByDay = useMemo(() => {
    const map = new Map<number, AttendanceRecord>()
    for (const r of attendance?.records ?? []) {
      const d = new Date(r.work_date)
      if (d.getFullYear() === attYear && d.getMonth() === attMonth) {
        map.set(d.getDate(), r)
      }
    }
    return map
  }, [attendance?.records, attYear, attMonth])

  const leaveDaysInMonth = useMemo(() => {
    const set = new Set<number>()
    for (const l of data?.leave_requests ?? []) {
      if (!['approved', 'pending'].includes((l.status || '').toLowerCase())) continue
      const start = new Date(l.start_date)
      const end = new Date(l.end_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === attYear && d.getMonth() === attMonth) set.add(d.getDate())
      }
    }
    return set
  }, [data?.leave_requests, attYear, attMonth])

  const dayStatus = (day: number): string => {
    const rec = attendanceByDay.get(day)
    if (rec?.status) return rec.status.toLowerCase()
    if (leaveDaysInMonth.has(day)) return 'leave'
    const dow = new Date(attYear, attMonth, day).getDay()
    if (dow === 0 || dow === 6) return 'weekend'
    return 'none'
  }

  const attSummary = useMemo(() => {
    const days = monthDays(attYear, attMonth)
    const counts = { present: 0, absent: 0, leave: 0, weekend: 0, holiday: 0, wfh: 0, ot: 0, none: 0 }
    for (let d = 1; d <= days; d++) {
      const rec = attendanceByDay.get(d)
      let s = rec?.status?.toLowerCase() ?? ''
      if (!s && leaveDaysInMonth.has(d)) s = 'leave'
      if (!s) {
        const dow = new Date(attYear, attMonth, d).getDay()
        s = (dow === 0 || dow === 6) ? 'weekend' : 'none'
      }
      if (s.includes('ot') || s === 'overtime') counts.ot++
      else if (s in counts) counts[s as keyof typeof counts]++
      else counts.none++
    }
    return counts
  }, [attendanceByDay, leaveDaysInMonth, attYear, attMonth])

  const isViewingCurrentMonth =
    attYear === new Date().getFullYear() && attMonth === new Date().getMonth()
  const todayDay = new Date().getDate()

  const leaveTakenByType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of data?.leave_requests ?? []) {
      if (l.status !== 'approved') continue
      map[l.leave_type] = (map[l.leave_type] ?? 0) + Number(l.days)
    }
    return map
  }, [data?.leave_requests])

  const nav = [
    { key: 'home' as const, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'leave' as const, label: 'Leaves', icon: Calendar },
    { key: 'claims' as const, label: 'Claims', icon: Receipt },
    { key: 'attendance' as const, label: 'Time Entries', icon: Clock },
    { key: 'payslips' as const, label: 'Payslips', icon: Wallet },
    { key: 'statutory' as const, label: 'Statutory', icon: ScrollText },
    { key: 'docs' as const, label: 'Documents', icon: FolderOpen },
  ]

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-14 rounded-2xl bg-slate-200/70" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-200/60" />)}
        </div>
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      </div>
    )
  }

  const displayName = data?.user?.name ?? data?.user?.email ?? 'Employee'

  return (
    <div className="ess-portal">
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Building2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl sm:text-2xl">ESS Portal</h1>
            <p className="desc-text mt-1">{displayName} · Employee self-service</p>
          </div>
        </div>
      </div>

      <div className="ess-portal-shell">
        <aside className="ess-portal-nav" aria-label="ESS sections">
          <p className="ess-portal-nav__label">Menu</p>
          {nav.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setView(item.key); setMsg(null) }}
              className={`ess-portal-nav__item ${view === item.key ? 'is-active' : ''}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <div className="ess-portal-main min-w-0">
          {msg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {msg}
            </div>
          )}

          {view === 'home' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Pending leave', value: leavePending, accent: '#3B82C4', go: 'leave' as const },
                  { label: 'Pending claims', value: claimsPending, accent: '#EF4444', go: 'claims' as const },
                  { label: 'Time status', value: checkedIn ? 'On shift' : 'Off shift', accent: '#64748B', go: 'attendance' as const },
                ].map(c => (
                  <button key={c.label} type="button" onClick={() => setView(c.go)} className="kpi-card text-left hover:border-[var(--color-primary)]">
                    <p className="kpi-card__label">{c.label}</p>
                    <p className="kpi-card__value" style={{ color: typeof c.value === 'number' ? undefined : c.accent }}>{c.value}</p>
                    <p className="kpi-card__sub">Open module →</p>
                  </button>
                ))}
              </div>

              <div className="ess-panel">
                <div className="ess-panel__head">
                  <p className="ess-panel__title">Leave balances</p>
                  <button type="button" className="text-xs font-bold text-[var(--color-primary)]" onClick={() => setView('leave')}>
                    Apply leave
                  </button>
                </div>
                <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {LEAVE_TYPES.map(t => {
                    const taken = leaveTakenByType[t.key] ?? 0
                    const entitled = t.key === 'annual' && leaveBalance != null ? leaveBalance + taken : null
                    const remaining = t.key === 'annual' && leaveBalance != null ? leaveBalance : null
                    return (
                      <div key={t.key} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        <div className="px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)` }}>
                          <p className="text-xs font-extrabold uppercase tracking-wide">{t.label}</p>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400">Taken</p>
                            <p className="text-sm font-extrabold text-[var(--dash-heading)]">{taken}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400">Entitled</p>
                            <p className="text-sm font-extrabold text-[var(--dash-heading)]">{entitled ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400">Left</p>
                            <p className="text-sm font-extrabold text-[var(--dash-heading)]">{remaining ?? '—'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full py-2 text-xs font-bold border-t border-slate-100 text-[var(--color-primary)] hover:bg-[var(--dash-bg)]"
                          onClick={() => { setLeaveForm(f => ({ ...f, leave_type: t.key })); setView('leave') }}
                        >
                          Apply →
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="ess-panel">
                  <div className="ess-panel__head">
                    <p className="ess-panel__title">Recent payslips</p>
                    <button type="button" className="text-xs font-bold text-[var(--color-primary)]" onClick={() => setView('payslips')}>View all</button>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(data?.payslips ?? []).slice(0, 4).length === 0 ? (
                      <li className="px-4 py-8 text-center text-sm font-medium text-slate-500">No payslips yet.</li>
                    ) : (data?.payslips ?? []).slice(0, 4).map(p => (
                      <li key={p.id} className="px-4 py-3 flex justify-between items-center gap-2">
                        <span className="text-sm font-bold">{p.period_label}</span>
                        <a className="btn-primary !py-1.5 !px-3 text-xs" href={p.external_url || `/api/ess/payslips/download?id=${p.id}`} target={p.external_url ? '_blank' : undefined} rel="noreferrer">
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ess-panel">
                  <div className="ess-panel__head">
                    <p className="ess-panel__title">Quick actions</p>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {[
                      { v: 'leave' as const, label: 'Apply leave' },
                      { v: 'claims' as const, label: 'New claim' },
                      { v: 'attendance' as const, label: 'Clock in/out' },
                      { v: 'payslips' as const, label: 'Find payslip' },
                      { v: 'docs' as const, label: 'Documents' },
                    ].map(a => (
                      <button key={a.v} type="button" onClick={() => setView(a.v)} className="copilot-chip">
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'profile' && (
            <div className="ess-panel max-w-3xl">
              <div className="ess-panel__head">
                <p className="ess-panel__title">Employee information</p>
                <button type="button" onClick={saveProfile} disabled={saving} className="btn-primary !py-1.5 !px-3 text-xs">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-slate-100">
                {([
                  { key: 'basic' as const, label: 'Basic details' },
                  { key: 'emergency' as const, label: 'Emergency' },
                  { key: 'bank' as const, label: 'Bank & ID' },
                ]).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setProfileSection(t.key)}
                    className={`ess-tab-chip mb-2 ${profileSection === t.key ? 'is-active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="p-5 space-y-3.5">
                {profileSection === 'basic' && (
                  <>
                    <div>
                      <label className="field-label">Full name</label>
                      <input className="form-input w-full" value={displayName} readOnly />
                    </div>
                    <div>
                      <label className="field-label">Work email</label>
                      <input className="form-input w-full" value={data?.user?.email ?? ''} readOnly />
                    </div>
                    <div>
                      <label className="field-label">Address</label>
                      <textarea className="form-input w-full" rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                  </>
                )}
                {profileSection === 'emergency' && (
                  <>
                    <div>
                      <label className="field-label">Emergency contact</label>
                      <input className="form-input w-full" value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">Emergency phone</label>
                      <input className="form-input w-full" value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} />
                    </div>
                  </>
                )}
                {profileSection === 'bank' && (
                  <>
                    <div>
                      <label className="field-label">Bank name</label>
                      <input className="form-input w-full" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">Bank account (masked)</label>
                      <input className="form-input w-full" value={form.bank_account_masked} onChange={e => setForm(f => ({ ...f, bank_account_masked: e.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">ID / passport ref</label>
                      <input className="form-input w-full" value={form.id_document_ref} onChange={e => setForm(f => ({ ...f, id_document_ref: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {view === 'leave' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {LEAVE_TYPES.slice(0, 3).map(t => (
                  <div key={t.key} className="kpi-card" style={{ borderLeft: `4px solid ${t.accent}` }}>
                    <p className="kpi-card__label">{t.label}</p>
                    <p className="kpi-card__value">
                      {t.key === 'annual' && leaveBalance != null ? `${leaveBalance}d` : `${leaveTakenByType[t.key] ?? 0}d`}
                    </p>
                    <p className="kpi-card__sub">{t.key === 'annual' ? 'Remaining balance' : 'Approved taken'}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="ess-panel">
                  <div className="ess-panel__head">
                    <p className="ess-panel__title">Leave application</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="field-label">Leave type *</label>
                      <select className="form-input w-full" value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}>
                        {LEAVE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Start date *</label>
                        <input type="date" className="form-input w-full" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">End date *</label>
                        <input type="date" className="form-input w-full" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Days *</label>
                      <input type="number" step="0.5" className="form-input w-full" value={leaveForm.days} onChange={e => setLeaveForm(f => ({ ...f, days: e.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">Reason *</label>
                      <textarea className="form-input w-full" rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for leave" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary flex-1" disabled={saving} onClick={applyLeave}>
                        {saving ? 'Submitting…' : 'Submit request'}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', days: '1', reason: '' })}>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ess-panel">
                  <div className="ess-panel__head flex-wrap">
                    <p className="ess-panel__title">Leave list</p>
                    <select className="form-input !w-auto !py-1.5 !text-xs" value={leaveFilter} onChange={e => setLeaveFilter(e.target.value)}>
                      <option value="all">All status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="ent-table text-left">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Days</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaves.length === 0 ? (
                          <tr><td colSpan={4} className="!text-center text-slate-500 py-8">No leave records for this filter.</td></tr>
                        ) : filteredLeaves.map(l => (
                          <tr key={l.id}>
                            <td className="capitalize font-semibold">{l.leave_type.replace(/_/g, ' ')}</td>
                            <td className="text-xs">{l.start_date} → {l.end_date}</td>
                            <td>{l.days}</td>
                            <td><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border capitalize ${statusBadge(l.status)}`}>{l.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'attendance' && (
            <div className="space-y-4">
              <div className="ess-panel">
                <div className="ess-panel__head flex-wrap gap-2">
                  <p className="ess-panel__title">Time entries</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select className="form-input !w-auto !py-1.5 !text-xs" value={attYear} onChange={e => setAttYear(Number(e.target.value))}>
                      {[attYear - 1, attYear, attYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="form-input !w-auto !py-1.5 !text-xs" value={attMonth} onChange={e => setAttMonth(Number(e.target.value))}>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-5 grid lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white p-5 shadow-lg">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Today</p>
                      <p className="text-2xl font-extrabold mt-1">
                        {attendance?.today?.check_in_at
                          ? new Date(attendance.today.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--'}
                        {attendance?.today?.check_out_at
                          ? ` → ${new Date(attendance.today.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </p>
                      <p className="text-xs font-semibold mt-1 text-white/80">{checkedIn ? 'Currently on shift' : 'Not checked in'}</p>
                      <p className="text-[10px] font-medium mt-2 text-white/70">Check-in / check-out is only available for today. Past and future days are read-only.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" disabled={saving || !isViewingCurrentMonth} onClick={() => checkInOut('check_in')}>
                        <LogIn className="w-4 h-4" /> Check in
                      </button>
                      <button type="button" className="btn-secondary" disabled={saving || !isViewingCurrentMonth || !attendance?.today?.check_in_at} onClick={() => checkInOut('check_out')}>
                        <LogOut className="w-4 h-4" /> Check out
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Present', value: attSummary.present },
                        { label: 'Absent', value: attSummary.absent },
                        { label: 'Leave', value: attSummary.leave },
                        { label: 'WFH', value: attSummary.wfh },
                        { label: 'OT', value: attSummary.ot },
                        { label: 'Holiday', value: attSummary.holiday },
                        { label: 'Weekend', value: attSummary.weekend },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                          <p className="text-[9px] font-extrabold uppercase text-slate-400">{s.label}</p>
                          <p className="text-sm font-extrabold text-[var(--dash-heading)]">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Attendance corrections and overtime require manager approval (submit via Claims / HR request).
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2">
                      {new Date(attYear, attMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: new Date(attYear, attMonth, 1).getDay() }).map((_, i) => (
                        <span key={`pad-${i}`} />
                      ))}
                      {Array.from({ length: monthDays(attYear, attMonth) }).map((_, i) => {
                        const day = i + 1
                        const status = dayStatus(day)
                        const isToday = isViewingCurrentMonth && day === todayDay
                        const tone =
                          status === 'absent' ? 'bg-red-100 text-red-700'
                          : status === 'leave' ? 'bg-violet-100 text-violet-800'
                          : status === 'holiday' ? 'bg-teal-100 text-teal-800'
                          : status === 'weekend' ? 'bg-slate-200 text-slate-600'
                          : status === 'wfh' ? 'bg-sky-100 text-sky-800'
                          : status === 'ot' || status === 'overtime' ? 'bg-amber-100 text-amber-900'
                          : status === 'present' ? 'bg-sky-100 text-sky-900'
                          : 'bg-slate-50 text-slate-400'
                        return (
                          <div
                            key={day}
                            className={`rounded-lg py-2 text-xs font-extrabold ${tone} ${isToday ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
                            title={status === 'none' ? 'No record (read-only)' : status}
                          >
                            {day}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" /> Present</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Absent</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Leave</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Weekend</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Holiday</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> WFH</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> OT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'payslips' && (
            <div className="ess-panel">
              <div className="ess-panel__head flex-wrap gap-2">
                <p className="ess-panel__title flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--color-primary)]" /> Payslips</p>
                <div className="flex flex-wrap gap-2">
                  <select className="form-input !w-auto !py-1.5 !text-xs" value={payslipYear} onChange={e => setPayslipYear(e.target.value)}>
                    {[0, 1, 2].map(o => {
                      const y = String(new Date().getFullYear() - o)
                      return <option key={y} value={y}>{y}</option>
                    })}
                  </select>
                  <select className="form-input !w-auto !py-1.5 !text-xs" value={payslipMonth} onChange={e => setPayslipMonth(e.target.value)}>
                    <option value="all">All months</option>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {filteredPayslips.length === 0 ? (
                  <li className="px-5 py-12 text-center">
                    <p className="text-sm font-bold text-slate-700">No payslips for this period</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Try another month, or ask HR if a payslip was published.</p>
                  </li>
                ) : filteredPayslips.map(p => (
                  <li key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--dash-heading)]">{p.period_label}</p>
                      <p className="text-xs font-medium text-slate-500">{p.period_month ? new Date(p.period_month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}</p>
                    </div>
                    <a
                      className="btn-primary !py-1.5 !px-3 text-xs"
                      href={p.external_url || `/api/ess/payslips/download?id=${p.id}`}
                      target={p.external_url ? '_blank' : undefined}
                      rel="noreferrer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view === 'claims' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="ess-panel">
                <div className="ess-panel__head">
                  <p className="ess-panel__title">New claim</p>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="field-label">Employee</label>
                    <input className="form-input w-full" value={displayName} readOnly />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Claim type</label>
                      <select className="form-input w-full" value={claimForm.claim_type} onChange={e => setClaimForm(f => ({ ...f, claim_type: e.target.value }))}>
                        <option value="travel">Travel</option>
                        <option value="medical">Medical</option>
                        <option value="meal">Meal</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Claim date</label>
                      <input type="date" className="form-input w-full" value={claimForm.claim_date} onChange={e => setClaimForm(f => ({ ...f, claim_date: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Title</label>
                    <input className="form-input w-full" value={claimForm.title} onChange={e => setClaimForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Client site travel" />
                  </div>
                  <div>
                    <label className="field-label">Amount</label>
                    <input className="form-input w-full" value={claimForm.amount} onChange={e => setClaimForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 80.00" />
                  </div>
                  <div>
                    <label className="field-label">Remarks</label>
                    <textarea className="form-input w-full" rows={2} value={claimForm.remarks} onChange={e => setClaimForm(f => ({ ...f, remarks: e.target.value }))} />
                  </div>
                  <button type="button" className="btn-primary w-full" disabled={saving} onClick={submitClaim}>
                    {saving ? 'Submitting…' : 'Submit claim'}
                  </button>
                </div>
              </div>

              <div className="ess-panel">
                <div className="ess-panel__head flex-wrap gap-2">
                  <p className="ess-panel__title">Claims list</p>
                  <select className="form-input !w-auto !py-1.5 !text-xs" value={claimStatusFilter} onChange={e => setClaimStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <ul className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                  {filteredClaims.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm font-medium text-slate-500">No claims yet.</li>
                  ) : filteredClaims.map(c => (
                    <li key={c.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[var(--dash-heading)]">{c.title}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 whitespace-pre-line line-clamp-2">{c.description}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(c.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border capitalize ${statusBadge(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {view === 'statutory' && (
            <div className="ess-panel">
              <div className="ess-panel__head flex-wrap gap-2">
                <p className="ess-panel__title">Statutory forms</p>
                <div className="flex flex-wrap gap-2">
                  <select className="form-input !w-auto !py-1.5 !text-xs" value={statType} onChange={e => setStatType(e.target.value as typeof statType)}>
                    {STATUTORY_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t.toUpperCase()}</option>)}
                  </select>
                  <select className="form-input !w-auto !py-1.5 !text-xs" value={statYear} onChange={e => setStatYear(e.target.value)}>
                    {[0, 1, 2].map(o => {
                      const y = String(new Date().getFullYear() - o)
                      return <option key={y} value={y}>{y}</option>
                    })}
                  </select>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {statutoryDocs.length === 0 ? (
                  <li className="px-5 py-12 text-center">
                    <p className="text-sm font-bold text-slate-700">No statutory forms published</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                      When HR shares Form EA / CP22 / PCB documents, they appear here for {statYear}.
                    </p>
                  </li>
                ) : statutoryDocs.map(d => (
                  <li key={d.id} className="px-5 py-3.5 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-sm font-bold">{d.title}</p>
                      <p className="text-xs font-semibold text-slate-500 capitalize">{d.doc_type}</p>
                    </div>
                    {d.external_url ? (
                      <a href={d.external_url} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs">View</a>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">No file</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view === 'docs' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="ess-panel">
                <div className="ess-panel__head">
                  <p className="ess-panel__title">Company documents</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {(data?.company_documents ?? []).length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm font-medium text-slate-500">No company documents shared.</li>
                  ) : (data?.company_documents ?? []).map((d, i) => (
                    <li key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{d.title}</p>
                          <p className="text-xs font-semibold text-slate-500 capitalize">{d.doc_type}</p>
                        </div>
                      </div>
                      {d.external_url && (
                        <a href={d.external_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--color-primary)] hover:underline">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="ess-panel">
                <div className="ess-panel__head">
                  <p className="ess-panel__title">My documents</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {empDocs.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm font-medium text-slate-500">No personal documents uploaded.</li>
                  ) : empDocs.map(d => (
                    <li key={d.id} className="px-5 py-3.5 flex justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{d.title}</p>
                        <p className="text-xs font-semibold text-slate-500 capitalize">{d.doc_type}</p>
                      </div>
                      {d.external_url && (
                        <a href={d.external_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--color-primary)] hover:underline">View</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
