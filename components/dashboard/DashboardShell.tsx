'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  Crown,
  Download,
  LogOut,
  Mail,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
  Users,
  PenLine,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  FileText,
  Zap,
  TrendingUp,
  Brain,
  Layers,
} from 'lucide-react'
import { BrandMark } from '@/components/ui/BrandMark'
import { InstallAppButton } from '@/components/pwa/PwaInstall'

type DashboardTab =
  | 'workspace' | 'pipeline' | 'candidates' | 'submissions' | 'interviews' | 'followups' | 'selected'
  | 'performance' | 'coach' | 'clients' | 'recruiters' | 'documents' | 'reports' | 'governance'
  | 'screen' | 'compose' | 'jobs' | 'analytics' | 'settings' | 'jd' | 'boolean' | 'import' | 'integrations'
  | 'comms' | 'ess' | 'hrconfig' | 'talent'

const AI_SHORTCUTS = [
  { id: 'hub', label: 'AI Hub', tab: 'coach' as DashboardTab, icon: Sparkles, tooltip: 'Central AI workspace', badge: 'AI' },
  { id: 'screen', label: 'AI Screening', tab: 'screen' as DashboardTab, icon: Brain, tooltip: 'Score CVs against a job description', badge: null },
  { id: 'boolean', label: 'Boolean Search', tab: 'boolean' as DashboardTab, icon: Search, tooltip: 'Generate job-board Boolean strings', badge: null },
  { id: 'compose', label: 'AI Composer', tab: 'compose' as DashboardTab, icon: Mail, tooltip: 'Draft emails and messages', badge: null },
  { id: 'jd', label: 'JD Writer', tab: 'jd' as DashboardTab, icon: FileText, tooltip: 'Create or optimize job descriptions', badge: null },
  { id: 'gen-post', label: 'Generate Job Post', tab: 'jobs' as DashboardTab, icon: PenLine, tooltip: 'Generate posts from job hub', badge: null },
] as const

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [aiNavExpanded, setAiNavExpanded] = useState(true)
  const [aiNavQuery, setAiNavQuery] = useState('')

  const [tenantRole, setTenantRole] = useState<string | null>(null)
  const [tenantPermissions, setTenantPermissions] = useState<{
    analytics?: { tenant?: boolean }
    candidates?: { delete?: boolean }
    jobs?: { delete?: boolean }
  } | null>(null)

  const [agentPendingCount, setAgentPendingCount] = useState(0)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/tenant')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (data.myRole) setTenantRole(data.myRole)
        if (data.myPermissions) setTenantPermissions(data.myPermissions)
      })
      .catch(() => { /* ignore */ })

    const loadAgents = () => {
      fetch('/api/agents?status=pending&limit=50')
        .then(r => r.json())
        .then(d => { setAgentPendingCount((d.suggestions ?? []).length) })
        .catch(() => { /* ignore */ })
    }
    loadAgents()
    const t = setInterval(loadAgents, 120000)
    return () => clearInterval(t)
  }, [status, session?.user])

  const isTenantAdminOrOwner = tenantRole === 'owner' || tenantRole === 'admin'
  const canSeeAnalytics = isTenantAdminOrOwner || Boolean(tenantPermissions?.analytics?.tenant)
  const canSeeReports = isTenantAdminOrOwner
  const canSeeClients = isTenantAdminOrOwner || tenantRole === 'recruiter'
  const canSeeRecruiters = isTenantAdminOrOwner

  const activeTab = useMemo(() => {
    if (pathname?.startsWith('/dashboard/candidates/')) return 'candidates'
    if (pathname?.startsWith('/dashboard/jobs/')) return 'jobs'
    return null
  }, [pathname])

  const filteredAiShortcuts = useMemo(() => {
    const q = aiNavQuery.trim().toLowerCase()
    if (!q) return AI_SHORTCUTS
    return AI_SHORTCUTS.filter(s => s.label.toLowerCase().includes(q) || s.tooltip.toLowerCase().includes(q))
  }, [aiNavQuery])

  const sidebarNavItems = useMemo(() => {
    const base: Array<{ tab: DashboardTab; icon: any; label: string; badge: string | null; section: 'recruitment' | 'ai' | 'ops' }> = [
      { tab: 'workspace', icon: TrendingUp, label: 'Dashboard', badge: agentPendingCount > 0 ? String(agentPendingCount) : null, section: 'recruitment' },
      { tab: 'jobs', icon: Briefcase, label: 'Jobs', badge: null, section: 'recruitment' },
      { tab: 'candidates', icon: Users, label: 'Candidates', badge: null, section: 'recruitment' },
      { tab: 'talent', icon: Search, label: 'Internal Talent Pool', badge: null, section: 'recruitment' },
    ]

    if (canSeeClients) base.push({ tab: 'clients' as DashboardTab, icon: Building2, label: 'Clients', badge: null, section: 'recruitment' })
    base.push(
      { tab: 'submissions', icon: Send, label: 'Submissions', badge: null, section: 'recruitment' },
      { tab: 'interviews', icon: Calendar, label: 'Interviews', badge: null, section: 'recruitment' },
      { tab: 'followups', icon: Clock, label: 'Follow-ups', badge: null, section: 'recruitment' },
      { tab: 'selected', icon: Award, label: 'Offer & Onboarding', badge: null, section: 'recruitment' },
    )
    if (canSeeRecruiters) base.push({ tab: 'recruiters', icon: Users, label: 'Recruiters', badge: null, section: 'recruitment' })

    base.push(
      { tab: 'documents' as DashboardTab, icon: FileText, label: 'Documents', badge: null, section: 'recruitment' },
      ...(canSeeReports ? [{ tab: 'reports' as DashboardTab, icon: Download, label: 'Reports', badge: null, section: 'recruitment' as const }] : []),
      { tab: 'performance' as DashboardTab, icon: Target, label: 'My Performance', badge: null, section: 'recruitment' },
      { tab: 'comms', icon: Mail, label: 'Communications', badge: null, section: 'ops' },
      ...(canSeeReports ? [{ tab: 'hrconfig' as DashboardTab, icon: Shield, label: 'HRMS', badge: null, section: 'ops' as const }] : []),
      { tab: 'ess' as DashboardTab, icon: Building2, label: 'ESS', badge: null, section: 'ops' },
      ...(isTenantAdminOrOwner ? [{ tab: 'governance' as DashboardTab, icon: Shield, label: 'Governance', badge: null, section: 'ops' as const }] : []),
      { tab: 'settings' as DashboardTab, icon: Shield, label: 'Settings', badge: null, section: 'ops' },
    )

    return base
  }, [agentPendingCount, canSeeClients, canSeeRecruiters, canSeeReports, isTenantAdminOrOwner])

  const goTab = (tab: DashboardTab) => {
    setMobileNavOpen(false)
    router.push(`/dashboard?tab=${encodeURIComponent(tab)}`)
  }

  const goAi = (s: (typeof AI_SHORTCUTS)[number]) => {
    setMobileNavOpen(false)
    if (s.id === 'gen-post') router.push(`/dashboard?tab=jobs&ai_action=gen-post`)
    else router.push(`/dashboard?tab=${encodeURIComponent(s.tab)}`)
  }

  return (
    <div className="min-h-dvh dashboard-root bg-[#FCFCFA] overflow-x-clip">
      <div className="flex h-dvh overflow-hidden">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`w-56 flex-shrink-0 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-md dash-sidebar z-50
          fixed lg:sticky lg:top-0 h-dvh inset-y-0 left-0 transform transition-transform duration-200
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandMark size={32} className="flex-shrink-0" />
              <div className="min-w-0">
                <p
                  className="text-[13px] font-extrabold text-white leading-tight tracking-tight"
                  style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
                >
                  SRP SmartRecruit
                </p>
                <p className="text-[10px] leading-tight mt-0.5 font-bold text-[#F97316]">Recruitment OS</p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden p-1.5 text-slate-300"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 px-2 py-2.5 space-y-0.5 overflow-y-auto min-h-0" aria-label="Workspace">
            {(['recruitment', 'ops'] as const).map(section => {
              const items = sidebarNavItems.filter(i => i.section === section)
              if (items.length === 0) return null
              const sectionLabel = section === 'recruitment' ? 'Recruitment' : 'Operations'
              return (
                <div key={section} className={section === 'recruitment' ? '' : 'mt-3 pt-2 border-t border-white/10'}>
                  <p className="px-2.5 mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">{sectionLabel}</p>
                  {items.map(({ tab, icon: Icon, label, badge }) => (
                    <button
                      key={`${section}-${tab}-${label}`}
                      type="button"
                      onClick={() => goTab(tab)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                        activeTab === tab ? 'bg-[var(--sidebar-active)] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`} />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {badge && (
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            activeTab === tab ? 'bg-white/25 text-white' : 'bg-teal-500/20 text-teal-200'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            })}

            {/* AI tools shortcuts */}
            <div className="mt-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAiNavExpanded(v => !v)}
                aria-expanded={aiNavExpanded}
                aria-controls="ai-tools-nav"
                className="w-full flex items-center gap-1 px-2.5 mb-2 rounded-md text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
              >
                <span className="flex-1 text-left text-[9px] font-extrabold uppercase tracking-widest">AI Tools</span>
                {aiNavExpanded ? <ChevronUp className="w-3 h-3 flex-shrink-0" aria-hidden /> : <ChevronDown className="w-3 h-3 flex-shrink-0" aria-hidden />}
              </button>

              {aiNavExpanded && (
                <div id="ai-tools-nav" role="group" aria-label="AI tool shortcuts">
                  <div className="px-1.5 mb-1.5">
                    <label htmlFor="ai-nav-search" className="sr-only">Search AI tools</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" aria-hidden />
                      <input
                        id="ai-nav-search"
                        type="search"
                        value={aiNavQuery}
                        onChange={e => setAiNavQuery(e.target.value)}
                        placeholder="Search AI…"
                        autoComplete="off"
                        className="w-full pl-7 pr-2 py-1.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F97316]"
                      />
                    </div>
                  </div>

                  <div>
                    {filteredAiShortcuts.map(s => {
                      const Icon = s.icon as any
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.tooltip}
                          onClick={() => goAi(s)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 text-slate-300 hover:text-white hover:bg-white/10"
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden />
                          <span className="flex-1 text-left truncate">{s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Owner panel (optional) */}
            {isTenantAdminOrOwner && (
              <button
                onClick={() => router.push('/owner')}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-bold text-amber-200 hover:bg-amber-500/15 transition-all mt-4 border border-amber-400/30"
              >
                <Crown className="w-3.5 h-3.5 flex-shrink-0" /> Owner Panel
              </button>
            )}
          </nav>

          <div className="px-2 py-3 border-t border-[var(--sidebar-border)] mt-auto">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              {session?.user && (session.user as any).image ? (
                // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL from session
                <img src={(session.user as any).image} alt="" className="w-8 h-8 rounded-full ring-2 ring-indigo-400/40 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]">
                  {(session?.user as any)?.name?.[0] ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{(session?.user as any)?.name}</p>
                <p className="text-[10px] truncate text-slate-400">{(session?.user as any)?.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-1.5 w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-bold text-slate-200 hover:text-white hover:bg-indigo-500/20 border border-white/15 hover:border-indigo-400/40 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto overflow-x-clip dashboard-main min-h-0 min-w-0 bg-[var(--dash-bg)]">
          <div className="sticky top-0 z-10 lg:hidden border-b border-slate-200 bg-white/95 backdrop-blur-md px-3 py-2 flex items-center gap-2 safe-top min-w-0">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 bg-white text-slate-700"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Layers className="w-4 h-4" />
            </button>
            <p className="flex-1 min-w-0 truncate text-sm font-extrabold text-[#0B1F14]" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>
              SRP SmartRecruit
            </p>
            <InstallAppButton compact />
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

