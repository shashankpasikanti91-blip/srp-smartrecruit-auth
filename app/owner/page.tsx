'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'
import {
  Users, Briefcase, FileText, CreditCard, Activity, Zap, AlertCircle,
  TrendingUp, LogOut, RefreshCw, Bell, Shield, ChevronRight, CheckCircle2,
  Clock, XCircle, Send
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalTenants: number
  activeTenants: number
  totalUsers: number; totalJobs: number; totalResumes: number
  totalSubs: number; totalTokenCostUsd: string; proUsers: number
}
interface User { id: string; name: string | null; email: string; role: string; created_at: string; is_active: boolean }
interface ActivityItem { id: string; user_id: string | null; event_type: string; severity: string; created_at: string; event_data: Record<string, unknown> | null; auth_users?: { name: string; email: string } }
interface TenantSummary {
  id: string
  short_id: string
  name: string
  slug: string
  plan: string
  plan_status: string
  is_active: boolean
  member_count: number
  active_members: number
  jobs_count: number
  candidates_count: number
  interviews_count: number
  offers_count: number
  screens_this_month: number
  latest_activity_at: string | null
}
interface PlatformHealth {
  dbOk: boolean
  failedLogins7d: number
  activeSessions: number
  pendingInvites: number
  application?: { ok: boolean; version: string; env: string; uptimeSec: number }
  ai?: { ok: boolean; configured: boolean; provider?: string; model?: string }
  storage?: { ok: boolean; detail?: string }
  email?: { ok: boolean; detail?: string }
  queues?: { ok: boolean; running: number; pending: number; failedJobs: number; failedItems: number }
  responseMs?: number
}
interface SecuritySummary {
  recentActivity: ActivityItem[]
  errorEvents7d: number
  failedLogins7d: number
}

type Tab = 'overview' | 'tenants' | 'users' | 'activity' | 'jobs' | 'resumes' | 'subscriptions' | 'tokens' | 'health' | 'security' | 'flags' | 'announcements'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',       label: 'Overview',       icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'tenants',        label: 'Tenants',        icon: <Shield className="w-4 h-4" /> },
  { id: 'users',          label: 'Users',          icon: <Users className="w-4 h-4" /> },
  { id: 'activity',       label: 'Activity Log',   icon: <Activity className="w-4 h-4" /> },
  { id: 'jobs',           label: 'Job Posts',      icon: <Briefcase className="w-4 h-4" /> },
  { id: 'resumes',        label: 'Resumes',        icon: <FileText className="w-4 h-4" /> },
  { id: 'subscriptions',  label: 'Subscriptions',  icon: <CreditCard className="w-4 h-4" /> },
  { id: 'tokens',         label: 'Token Usage',    icon: <Zap className="w-4 h-4" /> },
  { id: 'health',         label: 'System Health',  icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'security',       label: 'Security',       icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'flags',          label: 'Feature Flags',  icon: <Zap className="w-4 h-4" /> },
  { id: 'announcements',  label: 'Announcements',  icon: <Bell className="w-4 h-4" /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    info:     'bg-blue-500/10 text-blue-400',
    warning:  'bg-amber-500/10 text-amber-400',
    error:    'bg-red-500/10 text-red-400',
    critical: 'bg-red-600/20 text-red-300',
    active:   'bg-emerald-500/10 text-emerald-400',
    pending:  'bg-amber-500/10 text-amber-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] ?? 'bg-white/5 text-gray-400'}`}>
      {status}
    </span>
  )
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<Record<string, unknown[]>>({})
  const [health, setHealth] = useState<PlatformHealth | null>(null)
  const [security, setSecurity] = useState<SecuritySummary | null>(null)
  const [flags, setFlags] = useState<{ key: string; enabled: boolean; description?: string | null }[]>([])
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; body: string; severity: string; is_active: boolean }[]>([])
  const [announceForm, setAnnounceForm] = useState({ title: '', body: '', severity: 'info' })
  const [loading, setLoading] = useState(false)
  const [testNotifStatus, setTestNotifStatus] = useState<string | null>(null)
  const [tenantForm, setTenantForm] = useState({
    name: '',
    slug: '',
    ownerEmail: '',
    plan: 'free',
    maxUsers: '3',
    maxJobs: '5',
    maxCandidates: '200',
  })
  const [tenantActionStatus, setTenantActionStatus] = useState<string | null>(null)
  const [tokenSummary, setTokenSummary] = useState<{
    total_requests?: number
    total_tokens?: number
    estimated_cost_usd?: number
    by_operation?: Record<string, number>
  } | null>(null)
  const [piiAccess, setPiiAccess] = useState<string | null>(null)
  const [supportTenantId, setSupportTenantId] = useState('')
  const [supportReason, setSupportReason] = useState('')
  const [supportMsg, setSupportMsg] = useState('')

  const user = session?.user
  const role = (user as Record<string, unknown> | undefined)?.role as string | undefined

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated' && !isPlatformOwnerEmail(user?.email)) {
      router.replace('/dashboard')
    }
  }, [status, role, user, router])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?view=stats')
      const json = await res.json()
      setStats(json.stats)
    } finally { setLoading(false) }
  }, [])

  const fetchTab = useCallback(async (t: Tab) => {
    if (t === 'overview') { await fetchStats(); return }
    setLoading(true)
    try {
      const map: Record<Tab, string> = {
        overview: 'stats', tenants: 'tenants', users: 'users', activity: 'activity',
        jobs: 'jobs', resumes: 'resumes', subscriptions: 'subscriptions', tokens: 'tokens',
        health: 'health', security: 'security', flags: 'feature_flags', announcements: 'announcements',
      }
      const res = await fetch(`/api/admin?view=${map[t]}`)
      const json = await res.json()
      if (t === 'health') setHealth(json.health)
      else if (t === 'security') setSecurity(json.security)
      else if (t === 'flags') setFlags(json.flags ?? [])
      else if (t === 'announcements') setAnnouncements(json.announcements ?? [])
      else {
        const key = Object.keys(json).find(k => Array.isArray(json[k])) || Object.keys(json)[0]
        setData(prev => ({ ...prev, [t]: json[key] }))
        if (t === 'tokens' && json.summary) setTokenSummary(json.summary)
        if (t === 'resumes') setPiiAccess(json.pii_access ?? null)
      }
    } finally { setLoading(false) }
  }, [fetchStats])

  useEffect(() => {
    if (status !== 'authenticated') return
    void fetchStats()
    void fetchTab(tab)
    // Intentionally depend only on auth: tab switches load via handleTabChange to avoid duplicate fetches
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [status])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (!data[t] || t === 'overview' || t === 'flags' || t === 'announcements' || t === 'health' || t === 'security') {
      fetchTab(t)
    }
  }

  const testNotifications = async () => {
    setTestNotifStatus('sending…')
    const res = await fetch('/api/notify/test', { method: 'POST' })
    const json = await res.json()
    setTestNotifStatus(`Telegram: ${json.results?.telegram ?? '?'} | Email: ${json.results?.email ?? '?'}`)
    setTimeout(() => setTestNotifStatus(null), 5000)
  }

  const createTenant = async () => {
    setTenantActionStatus('Creating tenant…')
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tenant',
          name: tenantForm.name,
          slug: tenantForm.slug || undefined,
          ownerEmail: tenantForm.ownerEmail || undefined,
          plan: tenantForm.plan,
          maxUsers: Number(tenantForm.maxUsers || '3'),
          maxJobs: Number(tenantForm.maxJobs || '5'),
          maxCandidates: Number(tenantForm.maxCandidates || '200'),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create tenant')
      setTenantForm({ name: '', slug: '', ownerEmail: '', plan: 'free', maxUsers: '3', maxJobs: '5', maxCandidates: '200' })
      setTenantActionStatus(`Tenant created: ${json.shortId}`)
      await fetchTab('tenants')
      await fetchStats()
    } catch (e) {
      setTenantActionStatus(e instanceof Error ? e.message : 'Failed to create tenant')
    }
  }

  const updateTenant = async (tenantId: string, patch: Record<string, unknown>, message: string) => {
    setTenantActionStatus(message)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_tenant', tenantId, ...patch }),
    })
    const json = await res.json().catch(() => ({}))
    setTenantActionStatus(res.ok ? 'Tenant updated' : (json.error ?? 'Tenant update failed'))
    await fetchTab('tenants')
    await fetchStats()
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    { label: 'Tenants',          value: stats?.totalTenants ?? '—',    icon: <Shield className="w-5 h-5" />,      color: 'from-cyan-500 to-cyan-700' },
    { label: 'Active Tenants',   value: stats?.activeTenants ?? '—',   icon: <CheckCircle2 className="w-5 h-5" />,color: 'from-emerald-500 to-emerald-700' },
    { label: 'Total Users',      value: stats?.totalUsers ?? '—',      icon: <Users className="w-5 h-5" />,       color: 'from-indigo-500 to-indigo-700' },
    { label: 'Job Posts',        value: stats?.totalJobs ?? '—',       icon: <Briefcase className="w-5 h-5" />,   color: 'from-purple-500 to-purple-700' },
    { label: 'Resumes',          value: stats?.totalResumes ?? '—',    icon: <FileText className="w-5 h-5" />,    color: 'from-sky-500 to-sky-700' },
    { label: 'Pro Users',        value: stats?.proUsers ?? '—',        icon: <CreditCard className="w-5 h-5" />,  color: 'from-lime-500 to-lime-700' },
    { label: 'Subscriptions',    value: stats?.totalSubs ?? '—',       icon: <TrendingUp className="w-5 h-5" />,  color: 'from-amber-500 to-amber-700' },
    { label: 'AI Cost (USD)',     value: `$${stats?.totalTokenCostUsd ?? '0.0000'}`, icon: <Zap className="w-5 h-5" />, color: 'from-pink-500 to-pink-700' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/5 bg-[#0d0d1a] flex flex-col">
        <div className="p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm gradient-text">Owner Panel</span>
          </Link>
          <div className="mt-3 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Admin Access</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Notification test */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <button
            onClick={testNotifications}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
          >
            <Bell className="w-3.5 h-3.5" /> Test Alerts
          </button>
          {testNotifStatus && (
            <p className="text-[10px] text-emerald-400 px-3 leading-relaxed">{testNotifStatus}</p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">SRP Recruit AI Labs · Owner Dashboard</p>
          </div>
          <button
            onClick={() => fetchTab(tab)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card-dark text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="p-8">
          {/* ── Overview ──────────────────────────────────── */}
          {tab === 'overview' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map(s => (
                  <div key={s.label} className="glass-card-dark rounded-2xl p-5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>
                      {s.icon}
                    </div>
                    <div className="text-2xl font-extrabold text-white">{String(s.value)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick info */}
              <div className="glass-card-dark rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Owner Account
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Logged in as</p>
                    <p className="text-white font-medium">{user?.name}</p>
                    <p className="text-gray-400 text-xs">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Notifications</p>
                    <p className="text-white font-medium flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-indigo-400" /> Telegram + Email
                    </p>
                    <p className="text-gray-400 text-xs">pasikantishashank24@gmail.com</p>
                  </div>
                </div>
              </div>

              <div className="glass-card-dark rounded-2xl p-6 mt-6">
                <h3 className="font-bold text-white mb-4">Create Tenant</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <input value={tenantForm.name} onChange={e => setTenantForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Tenant name" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  <input value={tenantForm.slug} onChange={e => setTenantForm(prev => ({ ...prev, slug: e.target.value }))} placeholder="Slug (optional)" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  <input value={tenantForm.ownerEmail} onChange={e => setTenantForm(prev => ({ ...prev, ownerEmail: e.target.value }))} placeholder="Existing owner email (optional)" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  <select value={tenantForm.plan} onChange={e => setTenantForm(prev => ({ ...prev, plan: e.target.value }))} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                  <input value={tenantForm.maxUsers} onChange={e => setTenantForm(prev => ({ ...prev, maxUsers: e.target.value }))} placeholder="Max users" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  <input value={tenantForm.maxJobs} onChange={e => setTenantForm(prev => ({ ...prev, maxJobs: e.target.value }))} placeholder="Max jobs" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  <input value={tenantForm.maxCandidates} onChange={e => setTenantForm(prev => ({ ...prev, maxCandidates: e.target.value }))} placeholder="Max candidates" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={createTenant} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Create tenant</button>
                  {tenantActionStatus && <p className="text-xs text-gray-400">{tenantActionStatus}</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'tenants' && (
            <div className="glass-card-dark rounded-2xl p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5">
                  {['Tenant','Plan','Members','Usage','Last Activity','Controls'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>{((data.tenants ?? []) as TenantSummary[]).map((tenant, i) => (
                  <tr key={tenant.id} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{tenant.name}</p>
                      <p className="text-xs text-gray-500">{tenant.short_id} · {tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      <p>{tenant.plan}</p>
                      <p className="text-gray-500">{tenant.plan_status} · {tenant.is_active ? 'active' : 'suspended'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">{tenant.active_members}/{tenant.member_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <p>{tenant.jobs_count} jobs · {tenant.candidates_count} candidates</p>
                      <p>{tenant.interviews_count} interviews · {tenant.offers_count} offers · {tenant.screens_this_month} screens</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tenant.latest_activity_at ? fmt(tenant.latest_activity_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateTenant(tenant.id, { isActive: !tenant.is_active }, tenant.is_active ? 'Suspending tenant…' : 'Reactivating tenant…')} className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5">
                          {tenant.is_active ? 'Suspend' : 'Activate'}
                        </button>
                        <button onClick={() => updateTenant(tenant.id, { plan: tenant.plan === 'free' ? 'pro' : 'enterprise' }, 'Updating plan…')} className="rounded-md border border-indigo-500/20 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/10">
                          Upgrade plan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {tab === 'health' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { label: 'Database', value: health?.dbOk ? 'Healthy' : 'Unavailable' },
                  { label: 'Storage', value: health?.storage?.ok ? 'Writable' : (health?.storage?.detail ?? 'Unavailable') },
                  { label: 'Email (SMTP)', value: health?.email?.ok ? 'Configured' : 'Not configured' },
                  { label: 'AI Service', value: health?.ai?.configured ? `${health.ai.provider ?? 'ready'}` : 'Not configured' },
                  { label: 'Active Sessions', value: health?.activeSessions ?? '—' },
                  { label: 'Failed Logins (7d)', value: health?.failedLogins7d ?? '—' },
                  { label: 'Pending Invites', value: health?.pendingInvites ?? '—' },
                  { label: 'Health Latency', value: health?.responseMs != null ? `${health.responseMs} ms` : '—' },
                ].map(card => (
                  <div key={card.label} className="glass-card-dark rounded-2xl p-5">
                    <p className="text-xs text-gray-500">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{String(card.value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { label: 'Bulk Queue Running', value: health?.queues?.running ?? '—' },
                  { label: 'Bulk Queue Pending', value: health?.queues?.pending ?? '—' },
                  { label: 'Failed Bulk Jobs', value: health?.queues?.failedJobs ?? '—' },
                  { label: 'Failed Bulk Items', value: health?.queues?.failedItems ?? '—' },
                ].map(card => (
                  <div key={card.label} className="glass-card-dark rounded-2xl p-5">
                    <p className="text-xs text-gray-500">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{String(card.value)}</p>
                  </div>
                ))}
              </div>
              {health?.application && (
                <p className="text-xs text-gray-500">
                  App v{health.application.version} · {health.application.env} · uptime {health.application.uptimeSec}s
                  {health.ai?.model ? ` · AI model ${health.ai.model}` : ''}
                </p>
              )}
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card-dark rounded-2xl p-5">
                  <p className="text-xs text-gray-500">Failed Logins (7d)</p>
                  <p className="mt-2 text-2xl font-bold text-white">{security?.failedLogins7d ?? '—'}</p>
                </div>
                <div className="glass-card-dark rounded-2xl p-5">
                  <p className="text-xs text-gray-500">Error / Critical Events (7d)</p>
                  <p className="mt-2 text-2xl font-bold text-white">{security?.errorEvents7d ?? '—'}</p>
                </div>
              </div>
              <div className="glass-card-dark rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/5">
                    {['Event','User','Severity','Time'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{(security?.recentActivity ?? []).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                      <td className="px-5 py-3 text-white font-mono text-xs">{row.event_type}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{row.auth_users?.email ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.severity} /></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{fmt(row.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'flags' && (
            <div className="glass-card-dark rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-sm font-bold text-white">Platform feature flags</p>
                <p className="text-xs text-gray-500 mt-1">Global kill-switches — separate from tenant admin settings.</p>
              </div>
              <ul className="divide-y divide-white/5">
                {flags.length === 0 ? (
                  <li className="px-5 py-8 text-sm text-gray-500">No flags loaded. Run migrate_v32_platform.sql.</li>
                ) : flags.map(f => (
                  <li key={f.key} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white font-mono">{f.key}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.description || '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'set_feature_flag', flagKey: f.key, enabled: !f.enabled }),
                        })
                        fetchTab('flags')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${f.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}
                    >
                      {f.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'announcements' && (
            <div className="space-y-4">
              <div className="glass-card-dark rounded-2xl p-5 space-y-3">
                <p className="text-sm font-bold text-white">New announcement</p>
                <input
                  value={announceForm.title}
                  onChange={e => setAnnounceForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                />
                <textarea
                  value={announceForm.body}
                  onChange={e => setAnnounceForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Message"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                />
                <div className="flex gap-2">
                  <select
                    value={announceForm.severity}
                    onChange={e => setAnnounceForm(f => ({ ...f, severity: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'create_announcement',
                          title: announceForm.title,
                          announcementBody: announceForm.body,
                          severity: announceForm.severity,
                        }),
                      })
                      setAnnounceForm({ title: '', body: '', severity: 'info' })
                      fetchTab('announcements')
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                  >
                    Publish
                  </button>
                </div>
              </div>
              <ul className="space-y-2">
                {announcements.map(a => (
                  <li key={a.id} className="glass-card-dark rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{a.body}</p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase">{a.severity} · {a.is_active ? 'active' : 'off'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'toggle_announcement', announcementId: a.id }),
                        })
                        fetchTab('announcements')
                      }}
                      className="text-xs font-bold text-indigo-300"
                    >
                      Toggle
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Generic table view ─────────────────────────── */}
          {!['overview', 'tenants', 'health', 'security', 'flags', 'announcements'].includes(tab) && (
            <div className="glass-card-dark rounded-2xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <TableView
                  tab={tab}
                  rows={data[tab] ?? []}
                  tokenSummary={tokenSummary}
                  piiAccess={piiAccess}
                  supportTenantId={supportTenantId}
                  setSupportTenantId={setSupportTenantId}
                  supportReason={supportReason}
                  setSupportReason={setSupportReason}
                  supportMsg={supportMsg}
                  setSupportMsg={setSupportMsg}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function fmtShortId(row: Record<string, unknown>): string {
  const sid = row.short_id
  if (typeof sid === 'string' && sid.trim()) return sid
  const id = String(row.id ?? '')
  return id.length > 8 ? `${id.slice(0, 8)}…` : id || '—'
}

// ── Table renderer ────────────────────────────────────────────────────────────
function TableView({ tab, rows, tokenSummary, piiAccess, supportTenantId, setSupportTenantId, supportReason, setSupportReason, supportMsg, setSupportMsg }: {
  tab: Tab
  rows: unknown[]
  tokenSummary?: {
    total_requests?: number
    total_tokens?: number
    estimated_cost_usd?: number
    by_operation?: Record<string, number>
  } | null
  piiAccess?: string | null
  supportTenantId?: string
  setSupportTenantId?: (v: string) => void
  supportReason?: string
  setSupportReason?: (v: string) => void
  supportMsg?: string
  setSupportMsg?: (v: string) => void
}) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-600">
        <AlertCircle className="w-8 h-8 mb-3" />
        <p className="text-sm">No data yet</p>
      </div>
    )
  }

  const r = rows as Record<string, unknown>[]

  const table = tab === 'users' ? (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['Name','Email','Role','Active','Joined'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((u, i) => (
        <tr key={String(u.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-white font-medium">{String(u.name ?? '—')}</td>
          <td className="px-5 py-3 text-gray-400">{String(u.email)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(u.role)} /></td>
          <td className="px-5 py-3">{u.is_active ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(u.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  ) : tab === 'activity' ? (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['Event','User','Severity','Time'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((a, i) => (
        <tr key={String(a.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-white font-mono text-xs">{String(a.event_type)}</td>
          <td className="px-5 py-3 text-gray-400 text-xs">
            {String((a.auth_users as Record<string, unknown> | null)?.email ?? '—')}
          </td>
          <td className="px-5 py-3"><StatusBadge status={String(a.severity)} /></td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(a.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  ) : tab === 'jobs' ? (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['ID','Title','Status','Company','Applications','Created'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((j, i) => (
        <tr key={String(j.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-indigo-300 font-mono text-xs font-semibold">{fmtShortId(j)}</td>
          <td className="px-5 py-3 text-white font-medium">{String(j.title)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(j.status)} /></td>
          <td className="px-5 py-3 text-gray-400 text-xs">{String(j.company ?? '—')}</td>
          <td className="px-5 py-3 text-gray-300">{String(j.applications_count)}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(j.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  ) : tab === 'resumes' ? (
    <div>
      <div className="mx-5 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 space-y-2">
        <p className="font-semibold">
          Candidate PII access: {piiAccess === 'support_session' ? 'Unlocked (active support session)' : 'Locked / redacted by default'}
        </p>
        <p>Request time-boxed access; the Tenant Owner must approve before unredacted resumes are returned.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={supportTenantId ?? ''} onChange={e => setSupportTenantId?.(e.target.value)} placeholder="Tenant UUID"
            className="px-2 py-1.5 rounded bg-black/30 border border-white/10 text-white text-xs w-56" />
          <input value={supportReason ?? ''} onChange={e => setSupportReason?.(e.target.value)} placeholder="Reason"
            className="px-2 py-1.5 rounded bg-black/30 border border-white/10 text-white text-xs flex-1 min-w-[160px]" />
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold"
            onClick={async () => {
              const res = await fetch('/api/security/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'request',
                  tenant_id: supportTenantId,
                  reason: supportReason,
                  duration_hours: 4,
                }),
              })
              const json = await res.json().catch(() => ({}))
              setSupportMsg?.(res.ok ? 'Support request submitted.' : (json.error || 'Failed'))
            }}
          >
            Request support access
          </button>
        </div>
        {supportMsg && <p>{supportMsg}</p>}
      </div>
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['ID','Candidate','Email','AI Score','Status','Uploaded'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((rv, i) => (
        <tr key={String(rv.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-indigo-300 font-mono text-xs font-semibold">{fmtShortId(rv)}</td>
          <td className="px-5 py-3 text-white font-medium">{String(rv.candidate_name ?? '—')}</td>
          <td className="px-5 py-3 text-gray-400 text-xs">{String(rv.candidate_email ?? '—')}</td>
          <td className="px-5 py-3">
            <span className="text-indigo-300 font-bold">
              {rv.ai_score != null ? `${rv.ai_score}%` : '—'}
            </span>
          </td>
          <td className="px-5 py-3"><StatusBadge status={String(rv.status)} /></td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(rv.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
    </div>
  ) : tab === 'subscriptions' ? (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['User','Plan','Status','Amount','Period End'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((s, i) => (
        <tr key={String(s.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-400 text-xs">
            {String((s.auth_users as Record<string, unknown> | null)?.email ?? '—')}
          </td>
          <td className="px-5 py-3 text-white font-semibold">{String(s.plan)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(s.status)} /></td>
          <td className="px-5 py-3 text-gray-300">${((Number(s.amount_cents) ?? 0) / 100).toFixed(2)}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{s.current_period_end ? fmt(String(s.current_period_end)) : '—'}</td>
        </tr>
      ))}</tbody>
    </table>
  ) : tab === 'tokens' ? (
    <div>
      {tokenSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 px-1">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Requests</p>
            <p className="text-xl font-extrabold text-white mt-1">{Number(tokenSummary.total_requests ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Tokens</p>
            <p className="text-xl font-extrabold text-white mt-1">{Number(tokenSummary.total_tokens ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Est. Cost</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-1">${Number(tokenSummary.estimated_cost_usd ?? 0).toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Operations</p>
            <p className="text-xl font-extrabold text-indigo-300 mt-1">{Object.keys(tokenSummary.by_operation ?? {}).length}</p>
          </div>
        </div>
      )}
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['User','Model','Operation','Tokens','Cost','Time'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((t, i) => (
        <tr key={String(t.id ?? i)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-500 text-xs">{String(t.user_id ?? '').slice(0,8)}…</td>
          <td className="px-5 py-3 text-gray-300">{String(t.model)}</td>
          <td className="px-5 py-3 text-indigo-300 font-mono text-xs">{String(t.operation)}</td>
          <td className="px-5 py-3 text-white">{String((Number(t.prompt_tokens) + Number(t.completion_tokens)).toLocaleString())}</td>
          <td className="px-5 py-3 text-emerald-400">${Number(t.cost_usd).toFixed(6)}</td>
          <td className="px-5 py-3 text-gray-600 text-xs">{fmt(String(t.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
    </div>
  ) : null

  return table ? <div className="owner-table-wrap">{table}</div> : null
}
