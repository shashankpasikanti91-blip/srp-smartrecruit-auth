'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Users, Search, Plus, ChevronDown, LogOut,
  Zap, Star, TrendingUp, Filter, X, Crown,
  ArrowRight, BarChart3, Target, Inbox, Clock, CheckCircle
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Job {
  id: string; short_id: string; title: string; company: string
  location: string; type: string; status: string; applications_count: number
  created_at: string
}

interface Candidate {
  id: string; short_id: string; candidate_name: string; candidate_email: string
  ai_score: number | null
  match_category: 'best' | 'good' | 'partial' | 'poor' | null
  pipeline_stage: string; status: string; ai_skills: string[]; ai_summary: string
  job_posts: { id: string; short_id: string; title: string; company: string } | null
  created_at: string
}

interface StageCounts { [stage: string]: number }

// ── Constants ──────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'sourced',    label: 'Sourced',    color: 'bg-slate-700',      text: 'text-slate-300',   icon: Inbox },
  { key: 'applied',   label: 'Applied',    color: 'bg-blue-900/60',    text: 'text-blue-300',    icon: Briefcase },
  { key: 'screening', label: 'Screening',  color: 'bg-purple-900/60',  text: 'text-purple-300',  icon: Target },
  { key: 'interview', label: 'Interview',  color: 'bg-amber-900/60',   text: 'text-amber-300',   icon: Clock },
  { key: 'offer',     label: 'Offer',      color: 'bg-emerald-900/60', text: 'text-emerald-300', icon: CheckCircle },
  { key: 'hired',     label: 'Hired',      color: 'bg-green-900/60',   text: 'text-green-300',   icon: Star },
]

const MATCH_CONFIG = {
  best:    { label: 'Best Match',    bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  good:    { label: 'Good Match',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  partial: { label: 'Partial Match', bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  poor:    { label: 'Low Match',     bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MatchBadge({ category, score }: { category: string | null; score: number | null }) {
  if (!category) return <span className="text-xs text-gray-600">—</span>
  const c = MATCH_CONFIG[category as keyof typeof MATCH_CONFIG] ?? MATCH_CONFIG.poor
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {score != null && <span>{Math.round(score)}%</span>}
      {' '}{c.label}
    </span>
  )
}

function StagePill({ stage }: { stage: string }) {
  const s = PIPELINE_STAGES.find(p => p.key === stage) ?? PIPELINE_STAGES[0]
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.color} ${s.text}`}>{s.label}</span>
}

function ShortIdBadge({ id }: { id: string }) {
  return <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{id}</span>
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'pipeline' | 'candidates' | 'jobs' | 'analytics'>('pipeline')
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterMatch, setFilterMatch] = useState('')
  const [loading, setLoading] = useState(true)

  // New Job modal state
  const [showNewJob, setShowNewJob] = useState(false)
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '' })
  const [savingJob, setSavingJob] = useState(false)

  // New Candidate modal state
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [newCand, setNewCand] = useState({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '' })
  const [savingCand, setSavingCand] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQ) params.set('q', searchQ)
      if (filterStage) params.set('stage', filterStage)
      if (filterMatch) params.set('match', filterMatch)
      if (selectedJob) params.set('job_id', selectedJob)

      const [jRes, cRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch(`/api/candidates?${params.toString()}`),
      ])
      const jData = await jRes.json()
      const cData = await cRes.json()
      setJobs(jData.jobs ?? [])
      setCandidates(cData.candidates ?? [])
      setStageCounts(cData.stageCounts ?? {})
    } finally {
      setLoading(false)
    }
  }, [searchQ, filterStage, filterMatch, selectedJob])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status, loadData])

  const createJob = async () => {
    if (!newJob.title) return
    setSavingJob(true)
    await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newJob) })
    setSavingJob(false)
    setShowNewJob(false)
    setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '' })
    loadData()
  }

  const createCandidate = async () => {
    if (!newCand.candidate_name) return
    setSavingCand(true)
    const payload = {
      ...newCand,
      ai_skills: newCand.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
    }
    await fetch('/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSavingCand(false)
    setShowNewCandidate(false)
    setNewCand({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '' })
    loadData()
  }

  const moveStage = async (candidateId: string, stage: string) => {
    await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage }),
    })
    loadData()
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return null

  const user = session.user
  const sessionWithRole = session as { user: { role?: string; email?: string; name?: string; image?: string } }
  const isOwner = sessionWithRole.user?.role === 'owner' || user?.email === process.env.NEXT_PUBLIC_OWNER_EMAIL

  const totalCandidates = Object.values(stageCounts).reduce((a, b) => a + b, 0)
  const hiredCount = stageCounts['hired'] ?? 0
  const interviewCount = stageCounts['interview'] ?? 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex h-screen overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 border-r border-white/5 bg-black/40 flex flex-col">
          <div className="px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">SRP Recruit AI Labs</p>
                <p className="text-xs text-indigo-400 leading-none mt-0.5">SmartRecruit</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {([
              { tab: 'pipeline',   icon: BarChart3,  label: 'Pipeline'   },
              { tab: 'candidates', icon: Users,       label: 'Candidates' },
              { tab: 'jobs',       icon: Briefcase,   label: 'Jobs'       },
              { tab: 'analytics',  icon: TrendingUp,  label: 'Analytics'  },
            ] as const).map(({ tab, icon: Icon, label }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}

            {isOwner && (
              <button onClick={() => router.push('/owner')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all mt-4 border border-amber-500/20">
                <Crown className="w-4 h-4" /> Owner Panel
              </button>
            )}
          </nav>

          <div className="px-3 py-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              {user?.image
                ? <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                : <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{user?.name?.[0] ?? '?'}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-gray-600 hover:text-gray-400 transition-colors" title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Stats bar */}
          <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center gap-6 flex-wrap">
            {[
              { icon: Briefcase,     color: 'text-indigo-400', label: 'Jobs',       value: jobs.length },
              { icon: Users,         color: 'text-purple-400', label: 'Candidates', value: totalCandidates },
              { icon: Clock,         color: 'text-amber-400',  label: 'Interviews', value: interviewCount },
              { icon: CheckCircle,   color: 'text-green-400',  label: 'Hired',      value: hiredCount },
            ].map(({ icon: Icon, color, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-sm font-bold text-white">{value}</span>
                <div className="w-px h-4 bg-white/10 ml-4" />
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowNewCandidate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Candidate
              </button>
              <button onClick={() => setShowNewJob(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-all">
                <Plus className="w-3.5 h-3.5" /> New Job
              </button>
            </div>
          </div>

          <div className="px-6 py-6">

            {/* ── PIPELINE ─────────────────────────────────────────────────── */}
            {activeTab === 'pipeline' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-xl font-bold text-white">Pipeline</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Track candidates across every hiring stage</p>
                  </div>
                  <div className="relative">
                    <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 cursor-pointer focus:outline-none focus:border-indigo-500">
                      <option value="">All Jobs</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0,8)})</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {PIPELINE_STAGES.map(stage => {
                      const stageCands = candidates.filter(c => c.pipeline_stage === stage.key)
                      return (
                        <div key={stage.key} className="flex flex-col">
                          <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${stage.color}`}>
                            <span className={`text-xs font-semibold ${stage.text}`}>{stage.label}</span>
                            <span className={`text-xs font-bold ${stage.text}`}>{stageCands.length}</span>
                          </div>
                          <div className="flex-1 bg-white/[0.02] border border-t-0 border-white/5 rounded-b-lg p-2 space-y-2 min-h-[280px]">
                            {stageCands.length === 0
                              ? <p className="text-center text-xs text-gray-700 pt-6">Empty</p>
                              : stageCands.map(c => (
                                  <CandidateCard key={c.id} candidate={c} onMove={moveStage} />
                                ))
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CANDIDATES ───────────────────────────────────────────────── */}
            {activeTab === 'candidates' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-xl font-bold text-white">Candidates</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{candidates.length} total</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                    <option value="">All Stages</option>
                    {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                    <option value="">All Matches</option>
                    <option value="best">Best Match</option>
                    <option value="good">Good Match</option>
                    <option value="partial">Partial Match</option>
                  </select>
                  {(searchQ || filterStage || filterMatch) && (
                    <button onClick={() => { setSearchQ(''); setFilterStage(''); setFilterMatch('') }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                  <button onClick={loadData} className="ml-auto p-2 rounded hover:bg-white/5">
                    <Filter className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['ID', 'Candidate', 'Match', 'Stage', 'Job', 'Skills', 'Move Stage'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-600">No candidates found</td></tr>
                        ) : candidates.map((c, i) => (
                          <tr key={c.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                            <td className="px-4 py-3"><ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} /></td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{c.candidate_name}</p>
                              <p className="text-xs text-gray-500">{c.candidate_email}</p>
                            </td>
                            <td className="px-4 py-3"><MatchBadge category={c.match_category} score={c.ai_score} /></td>
                            <td className="px-4 py-3"><StagePill stage={c.pipeline_stage} /></td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {c.job_posts ? (
                                <><p>{c.job_posts.title}</p><ShortIdBadge id={c.job_posts.short_id ?? ''} /></>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[140px]">
                                {(c.ai_skills ?? []).slice(0, 3).map(s => (
                                  <span key={s} className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{s}</span>
                                ))}
                                {(c.ai_skills?.length ?? 0) > 3 && (
                                  <span className="text-xs text-gray-600">+{c.ai_skills.length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select defaultValue={c.pipeline_stage} onChange={e => moveStage(c.id, e.target.value)}
                                className="text-xs bg-white/5 border border-white/10 text-gray-400 rounded px-2 py-1 cursor-pointer focus:outline-none">
                                {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── JOBS ─────────────────────────────────────────────────────── */}
            {activeTab === 'jobs' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-xl font-bold text-white">Job Posts</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{jobs.length} jobs</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center">
                    <Briefcase className="w-10 h-10 text-gray-700 mb-3" />
                    <p className="text-gray-500 mb-4">No jobs yet. Create your first job post.</p>
                    <button onClick={() => setShowNewJob(true)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors">
                      Create Job Post
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {jobs.map(job => {
                      const jobCands = candidates.filter(c => c.job_posts?.id === job.id)
                      return (
                        <div key={job.id} className="glass-card rounded-xl p-5 border border-white/5 hover:border-indigo-500/30 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {job.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-base mb-1">{job.title}</h3>
                          <p className="text-sm text-gray-400">{job.company}{job.location && ` · ${job.location}`}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3.5 h-3.5" />
                              {jobCands.length} candidates
                            </div>
                            <button onClick={() => { setSelectedJob(job.id); setActiveTab('pipeline') }}
                              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                              View pipeline <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS ────────────────────────────────────────────────── */}
            {activeTab === 'analytics' && (
              <div>
                <h1 className="text-xl font-bold text-white mb-6">Analytics</h1>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {PIPELINE_STAGES.map(s => (
                    <div key={s.key} className="glass-card rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                      <p className="text-3xl font-extrabold text-white">{stageCounts[s.key] ?? 0}</p>
                    </div>
                  ))}
                </div>
                <div className="glass-card rounded-xl p-5 border border-white/5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">AI Match Distribution</h2>
                  <div className="space-y-3">
                    {(['best', 'good', 'partial', 'poor'] as const).map(m => {
                      const count = candidates.filter(c => c.match_category === m).length
                      const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0
                      const cfg = MATCH_CONFIG[m]
                      return (
                        <div key={m} className="flex items-center gap-3">
                          <span className={`text-xs w-24 ${cfg.text}`}>{cfg.label}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bg.replace('/20', '/60')}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── New Job Modal ──────────────────────────────────────────────────────── */}
      {showNewJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">New Job Post</h2>
              <button onClick={() => setShowNewJob(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {([
                { key: 'title',       label: 'Job Title *',    placeholder: 'e.g. Senior Software Engineer' },
                { key: 'company',     label: 'Company',        placeholder: 'e.g. SRP AI Labs' },
                { key: 'location',    label: 'Location',       placeholder: 'e.g. Hyderabad / Remote' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={newJob[key]} onChange={e => setNewJob(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select value={newJob.type} onChange={e => setNewJob(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                  {['full-time', 'part-time', 'contract', 'remote', 'internship'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Role overview…"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewJob(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm text-gray-400 hover:bg-white/10">Cancel</button>
              <button onClick={createJob} disabled={savingJob || !newJob.title}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50 transition-colors">
                {savingJob ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Candidate Modal ──────────────────────────────────────────────── */}
      {showNewCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Add Candidate</h2>
              <button onClick={() => setShowNewCandidate(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {([
                { key: 'candidate_name',  label: 'Full Name *',              placeholder: 'e.g. Priya Sharma' },
                { key: 'candidate_email', label: 'Email',                    placeholder: 'candidate@email.com' },
                { key: 'candidate_phone', label: 'Phone',                    placeholder: '+91 98765 43210' },
                { key: 'ai_skills',       label: 'Skills (comma-separated)', placeholder: 'React, Node.js, Python' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={newCand[key]} onChange={e => setNewCand(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assign to Job (optional)</label>
                <select value={newCand.job_post_id} onChange={e => setNewCand(p => ({ ...p, job_post_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                  <option value="">— No job —</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0, 8)})</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewCandidate(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm text-gray-400 hover:bg-white/10">Cancel</button>
              <button onClick={createCandidate} disabled={savingCand || !newCand.candidate_name}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50 transition-colors">
                {savingCand ? 'Adding…' : 'Add Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Candidate Card (pipeline kanban) ──────────────────────────────────────────
function CandidateCard({ candidate: c, onMove }: {
  candidate: Candidate
  onMove: (id: string, stage: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5 hover:border-indigo-500/20 transition-all">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{c.candidate_name}</p>
          <p className="text-xs text-gray-600 truncate">{c.candidate_email}</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-gray-600 hover:text-gray-400">
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className="mt-1.5">
        <MatchBadge category={c.match_category} score={c.ai_score} />
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <p className="text-xs text-gray-500 mb-1">Move to stage:</p>
          <div className="flex flex-wrap gap-1">
            {PIPELINE_STAGES.filter(s => s.key !== c.pipeline_stage).map(s => (
              <button key={s.key} onClick={() => onMove(c.id, s.key)}
                className={`text-xs px-2 py-0.5 rounded ${s.color} ${s.text} hover:opacity-80 transition-opacity`}>
                {s.label}
              </button>
            ))}
          </div>
          {c.ai_summary && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{c.ai_summary}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(c.ai_skills ?? []).slice(0, 4).map(s => (
              <span key={s} className="text-xs bg-white/5 text-gray-500 px-1.5 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
