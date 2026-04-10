'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Users, Search, Plus, ChevronDown, LogOut,
  Zap, Star, TrendingUp, X, Crown, Filter,
  ArrowRight, BarChart3, Target, Inbox, Clock, CheckCircle,
  Upload, FileText, Sparkles, Copy, Check, Mail,
  RefreshCw, AlertCircle, Layers, Brain, ChevronRight,
  MoreVertical, Send, Loader2, Download
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Job {
  id: string; short_id: string; title: string; company: string
  location: string; type: string; status: string; applications_count: number
  description?: string; requirements?: string
  created_at: string
  // saved social posts attached by /api/jobs GET
  post_contents?: Record<string, string> | null
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

interface ScreenResult {
  name: string; email: string; contact_number?: string; current_company?: string
  score: number; decision: string
  evaluation?: {
    // AI returns these field names
    candidate_strengths?: string[]; candidate_weaknesses?: string[]
    low_or_missing_match_skills?: string[]; high_match_skills?: string[]
    medium_match_skills?: string[]; risk_level?: string; risk_explanation?: string
    justification?: string; overall_fit_rating?: number
    // legacy aliases
    strengths?: string[]; weaknesses?: string[]; missing_skills?: string[]
  }
  // set by server after DB insert
  db_id?: string; short_id?: string
  candidate_id?: string
}

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

  const [activeTab, setActiveTab] = useState<'pipeline' | 'candidates' | 'screen' | 'compose' | 'jobs' | 'analytics'>('pipeline')
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
  const [seedingDemo, setSeedingDemo] = useState(false)

  // New Candidate modal state
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [newCand, setNewCand] = useState({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '' })
  const [savingCand, setSavingCand] = useState(false)

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // AI Screen state
  const [screenMode, setScreenMode] = useState<'single' | 'bulk'>('single')
  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [bulkTexts, setBulkTexts] = useState<Array<{ text: string; filename: string }>>([])
  const [screenJobId, setScreenJobId] = useState('')
  const [screening, setScreening] = useState(false)
  const [screenResults, setScreenResults] = useState<ScreenResult[]>([])
  const [screenError, setScreenError] = useState('')

  // Compose state
  const [composeMode, setComposeMode] = useState<'generate' | 'rewrite' | 'paraphrase' | 'reply'>('generate')
  const [emailType, setEmailType] = useState('interview_invite')
  const [platform, setPlatform] = useState('Gmail')
  const [tone, setTone] = useState('professional')
  const [composeFields, setComposeFields] = useState({
    candidate_name: '', role_title: '', company_name: '', recruiter_name: '',
    interview_date: '', interview_format: '', salary_package: '', start_date: '', custom_notes: '',
  })
  const [rawInput, setRawInput] = useState('')
  const [composing, setComposing] = useState(false)
  const [composeOutput, setComposeOutput] = useState('')
  const [composeError, setComposeError] = useState('')
  const [copied, setCopied] = useState(false)

  // Job post generator state
  const [genPostJob, setGenPostJob] = useState<Job | null>(null)
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [generatedPosts, setGeneratedPosts] = useState<Record<string, string>>({})
  const [genPostError, setGenPostError] = useState('')
  const [genPostTab, setGenPostTab] = useState('linkedin')
  const [genCustomPrompt, setGenCustomPrompt] = useState('')
  const [copiedPostKey, setCopiedPostKey] = useState('')

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

  const createAndGenerate = async () => {
    if (!newJob.title) return
    setSavingJob(true)
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newJob) })
    const data = await res.json()
    setSavingJob(false)
    setShowNewJob(false)
    setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '' })
    await loadData()
    if (data.job) {
      setGenPostJob(data.job)
      setGeneratedPosts({}); setGenCustomPrompt(''); setGenPostError('')
    }
  }

  const seedDemo = async () => {
    setSeedingDemo(true)
    try {
      const res = await fetch('/api/seed-demo', { method: 'POST' })
      const data = await res.json()
      if (res.ok) { await loadData(); setActiveTab('jobs') }
      else alert(data.error ?? 'Failed to seed demo data')
    } catch { alert('Network error while seeding') }
    finally { setSeedingDemo(false) }
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
    // Optimistic update
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, pipeline_stage: stage } : c))
    setStageCounts(prev => {
      const old = candidates.find(c => c.id === candidateId)?.pipeline_stage
      if (!old) return prev
      return { ...prev, [old]: Math.max(0, (prev[old] ?? 1) - 1), [stage]: (prev[stage] ?? 0) + 1 }
    })
    await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage }),
    })
  }

  const runScreening = async () => {
    setScreening(true); setScreenError(''); setScreenResults([])
    try {
      const resumes = screenMode === 'single'
        ? [{ text: resumeText, filename: 'pasted_resume' }]
        : bulkTexts
      const res = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText, resumes, job_post_id: screenJobId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setScreenError(data.error ?? 'Screening failed'); return }
      setScreenResults(data.results ?? [])
      if ((data.results?.length ?? 0) > 0) {
        await loadData()
        // Auto-switch to candidates tab so user sees the saved records
        setActiveTab('candidates')
      }
    } catch (e) {
      setScreenError(String(e))
    } finally {
      setScreening(false)
    }
  }

  const runCompose = async () => {
    setComposing(true); setComposeError(''); setComposeOutput('')
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: composeMode === 'generate' ? 'generate' : 'rewrite',
          action: composeMode, // 'generate' | 'rewrite' | 'paraphrase' | 'reply'
          email_type: emailType, platform, tone, raw_input: rawInput, ...composeFields,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setComposeError(data.error ?? 'Generation failed'); return }
      setComposeOutput(data.content ?? '')
    } catch (e) {
      setComposeError(String(e))
    } finally {
      setComposing(false)
    }
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(composeOutput)
    } catch {
      // Fallback for HTTP contexts
      const ta = document.createElement('textarea')
      ta.value = composeOutput
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const openJobDetails = (job: Job) => {
    setGenPostJob(job)
    const saved = job.post_contents
    const posts = saved
      ? Object.fromEntries(
          ['linkedin','whatsapp','email','twitter','indeed','telegram','facebook']
            .filter(k => saved[k])
            .map(k => [k, saved[k]])
        )
      : {}
    setGeneratedPosts(posts)
    const firstKey = Object.keys(posts)[0]
    setGenPostTab(firstKey || 'linkedin')
    setGenCustomPrompt('')
    setGenPostError('')
  }

  const generateJobPosts = async (job: Job) => {
    setGeneratingPosts(true); setGenPostError(''); setGeneratedPosts({})
    try {
      const res = await fetch('/api/jobs/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_post_id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          type: job.type,
          description: job.description,
          requirements: job.requirements,
          custom_prompt: genCustomPrompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGenPostError(data.error ?? 'Failed to generate posts'); return }
      setGeneratedPosts(data.posts ?? {})
      const firstKey = Object.keys(data.posts ?? {})[0]
      if (firstKey) setGenPostTab(firstKey)
      await loadData()
    } catch (e) {
      setGenPostError(String(e))
    } finally {
      setGeneratingPosts(false)
    }
  }

  const copyPostContent = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopiedPostKey(key); setTimeout(() => setCopiedPostKey(''), 2000)
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
              { tab: 'pipeline',   icon: Layers,      label: 'Pipeline',   badge: null },
              { tab: 'candidates', icon: Users,        label: 'Candidates', badge: null },
              { tab: 'screen',     icon: Brain,        label: 'AI Screen',  badge: 'AI' },
              { tab: 'compose',    icon: Mail,         label: 'Compose',    badge: 'AI' },
              { tab: 'jobs',       icon: Briefcase,    label: 'Jobs',       badge: null },
              { tab: 'analytics',  icon: BarChart3,    label: 'Analytics',  badge: null },
            ] as const).map(({ tab, icon: Icon, label, badge }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{label}</span>
                {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300">{badge}</span>}
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
                    <p className="text-sm text-gray-500 mt-0.5">Drag & drop candidates across stages</p>
                  </div>
                  <div className="relative">
                    <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 cursor-pointer focus:outline-none focus:border-indigo-500">
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
                      const isOver = dragOverStage === stage.key
                      return (
                        <div key={stage.key} className="flex flex-col"
                          onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                          onDragLeave={() => setDragOverStage(null)}
                          onDrop={e => {
                            e.preventDefault()
                            if (draggingId) moveStage(draggingId, stage.key)
                            setDraggingId(null); setDragOverStage(null)
                          }}>
                          <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${stage.color}`}>
                            <span className={`text-xs font-semibold ${stage.text}`}>{stage.label}</span>
                            <span className={`text-xs font-bold ${stage.text}`}>{stageCands.length}</span>
                          </div>
                          <div className={`flex-1 border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[280px] transition-colors ${
                            isOver ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-white/[0.02] border-white/5'
                          }`}>
                            {stageCands.length === 0
                              ? <p className={`text-center text-xs pt-6 ${isOver ? 'text-indigo-400' : 'text-gray-700'}`}>
                                  {isOver ? 'Drop here' : 'Empty'}
                                </p>
                              : stageCands.map(c => (
                                  <KanbanCard key={c.id} candidate={c} onMove={moveStage}
                                    dragging={draggingId === c.id}
                                    onDragStart={() => setDraggingId(c.id)}
                                    onDragEnd={() => { setDraggingId(null); setDragOverStage(null) }} />
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
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                    <option value="">All Stages</option>
                    {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
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

            {/* ── AI SCREEN ────────────────────────────────────────────────── */}
            {activeTab === 'screen' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">AI Screening</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Score & rank candidates against your job description</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {(['single', 'bulk'] as const).map(m => (
                      <button key={m} onClick={() => setScreenMode(m)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${screenMode === m ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                        {m === 'single' ? 'Single CV' : 'Bulk CVs'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {/* JD panel */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Job Description</label>
                    <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={10}
                      placeholder="Paste the full job description here…"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" />
                    <p className="text-xs text-gray-600">Or upload JD file:</p>
                    <FileUploadZone label="Upload JD (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple={false}
                      onTexts={([t]) => setJdText(t.text)} disabled={screening} />
                  </div>

                  {/* Resume panel */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {screenMode === 'single' ? 'Candidate Resume' : `Bulk Resumes (${bulkTexts.length} loaded)`}
                    </label>
                    {screenMode === 'single' ? (
                      <>
                        <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={10}
                          placeholder="Paste the candidate's resume text here…"
                          className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" />
                        <p className="text-xs text-gray-600">Or upload resume file:</p>
                        <FileUploadZone label="Upload Resume (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple={false}
                          onTexts={([t]) => setResumeText(t.text)} disabled={screening} />
                      </>
                    ) : (
                      <FileUploadZone label="Upload multiple CVs (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple
                        onTexts={ts => setBulkTexts(ts)} disabled={screening} />
                    )}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Link to Job (optional)</label>
                      <select value={screenJobId} onChange={e => setScreenJobId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-purple-500">
                        <option value="">— No job —</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0,8)})</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {screenError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {screenError}
                    {screenError.includes('OPENAI_API_KEY') && <span className="ml-1 text-gray-500">— add <code className="text-red-300">OPENAI_API_KEY</code> to your .env file</span>}
                  </div>
                )}

                <button onClick={runScreening}
                  disabled={screening || !jdText || (screenMode === 'single' ? !resumeText : bulkTexts.length === 0)}
                  className="mb-6 flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-sm transition-all disabled:opacity-50">
                  {screening ? <><Loader2 className="w-4 h-4 animate-spin" /> Screening…</> : <><Sparkles className="w-4 h-4" /> Run AI Screening</>}
                </button>

                {screenResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-300">{screenResults.length} result{screenResults.length > 1 ? 's' : ''} — saved to Candidates</h2>
                      <button onClick={() => setActiveTab('candidates')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                        View in Candidates →
                      </button>
                    </div>
                    {screenResults.map((r, i) => (
                      <ScreenResultCard key={i} result={r} onAddCandidate={(cid) => { loadData() }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── COMPOSE ──────────────────────────────────────────────────── */}
            {activeTab === 'compose' && (
              <div>
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">AI Compose</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Generate, rewrite or reply to recruitment messages</p>
                  </div>
                </div>

                {/* ── Two mode cards ─────────────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">

                  {/* ── Panel A: Generate New Email ── */}
                  <div className={`rounded-2xl border p-5 transition-all ${
                    composeMode === 'generate'
                      ? 'border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20'
                      : 'border-white/8 bg-white/[0.02] opacity-60 hover:opacity-80'
                  }`}>
                    <button
                      className="w-full text-left mb-4"
                      onClick={() => setComposeMode('generate')}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${composeMode === 'generate' ? 'border-indigo-400 bg-indigo-400' : 'border-gray-600'}`}>
                          {composeMode === 'generate' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-semibold text-white">Generate New Email</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">From scratch</span>
                      </div>
                      <p className="text-xs text-gray-500 pl-5">Choose email type, fill in details — AI writes it for you</p>
                    </button>

                    {composeMode === 'generate' && (
                      <div className="space-y-4">
                        {/* Email type grid */}
                        <div>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Email Type</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {([
                              { key: 'rejection',        label: '❌ Rejection' },
                              { key: 'shortlist',        label: '✅ Shortlist' },
                              { key: 'interview_invite', label: '📅 Interview Invite' },
                              { key: 'offer',            label: '🎉 Offer Letter' },
                              { key: 'followup',         label: '🔁 Follow-up' },
                              { key: 'technical_test',   label: '🧪 Technical Test' },
                              { key: 'thank_you',        label: '🙏 Thank You' },
                              { key: 'on_hold',          label: '⏸ On Hold' },
                              { key: 'reference_check',  label: '📋 Reference Check' },
                              { key: 'whatsapp_followup',label: '💬 WhatsApp Follow-up' },
                            ] as const).map(({ key, label }) => (
                              <button key={key} onClick={() => setEmailType(key)}
                                className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  emailType === key
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Platform + Tone */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Platform</label>
                            <select value={platform} onChange={e => setPlatform(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                              {['Gmail', 'LinkedIn', 'WhatsApp', 'Outlook', 'Telegram'].map(p => <option key={p} className="bg-[#1a1a2e] text-gray-200">{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Tone</label>
                            <select value={tone} onChange={e => setTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                              {['formal', 'professional', 'semi-formal', 'friendly', 'casual'].map(t => <option key={t} className="bg-[#1a1a2e] text-gray-200">{t}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Detail fields */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {([
                            { key: 'candidate_name',  label: "Candidate Name",    placeholder: 'Priya Sharma' },
                            { key: 'role_title',       label: 'Role Title',        placeholder: 'Senior Engineer' },
                            { key: 'company_name',     label: 'Company Name',      placeholder: 'SRP AI Labs' },
                            { key: 'recruiter_name',   label: 'Recruiter Name',    placeholder: 'Rahul' },
                            { key: 'interview_date',   label: 'Interview Date',    placeholder: 'Mon 14 Jul, 3:00 PM' },
                            { key: 'interview_format', label: 'Interview Format',  placeholder: 'Video – Zoom' },
                            { key: 'salary_package',   label: 'Salary Package',    placeholder: '₹12 LPA' },
                            { key: 'start_date',       label: 'Start Date',        placeholder: '1 Aug 2025' },
                          ] as const).map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label className="text-xs text-gray-400 font-medium mb-1 block">{label}</label>
                              <input value={composeFields[key]} onChange={e => setComposeFields(p => ({ ...p, [key]: e.target.value }))}
                                placeholder={placeholder}
                                className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-medium mb-1 block">Custom Notes (optional)</label>
                          <textarea value={composeFields.custom_notes} onChange={e => setComposeFields(p => ({ ...p, custom_notes: e.target.value }))}
                            rows={2} placeholder="Any extra details for the AI to include…"
                            className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Panel B: Rewrite / Paraphrase / Reply ── */}
                  <div className={`rounded-2xl border p-5 transition-all ${
                    composeMode !== 'generate'
                      ? 'border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/20'
                      : 'border-white/8 bg-white/[0.02] opacity-60 hover:opacity-80'
                  }`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full border-2 ${composeMode !== 'generate' ? 'border-purple-400 bg-purple-400' : 'border-gray-600'}`} />
                        <span className="text-sm font-semibold text-white">Rewrite / Paraphrase / Reply</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Existing message</span>
                      </div>
                      <p className="text-xs text-gray-500 pl-5">Paste a message — AI rewrites, rephrases, or drafts a reply</p>
                    </div>

                    {/* Action type selector */}
                    <div className="flex gap-2 mb-4">
                      {([
                        { key: 'rewrite',     label: '✏️ Rewrite',     desc: 'Improve clarity & tone' },
                        { key: 'paraphrase',  label: '🔄 Paraphrase',  desc: 'Same meaning, new words' },
                        { key: 'reply',       label: '↩️ Reply',       desc: 'Compose a response' },
                      ] as const).map(({ key, label, desc }) => (
                        <button key={key} onClick={() => setComposeMode(key)}
                          className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl text-xs font-medium transition-all border ${
                            composeMode === key
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                          }`}>
                          <span className="text-sm mb-0.5">{label.split(' ')[0]}</span>
                          <span className="font-semibold">{label.split(' ')[1]}</span>
                          <span className={`text-[10px] mt-0.5 ${composeMode === key ? 'text-purple-200' : 'text-gray-600'}`}>{desc}</span>
                        </button>
                      ))}
                    </div>

                    {composeMode !== 'generate' && (
                      <div className="space-y-3">
                        {/* Original message */}
                        <div>
                          <label className="text-xs text-gray-400 font-medium mb-1 block">
                            {composeMode === 'reply' ? 'Message to reply to' : 'Original message'}
                          </label>
                          <textarea value={rawInput} onChange={e => setRawInput(e.target.value)}
                            rows={7} placeholder={
                              composeMode === 'reply'
                                ? 'Paste the message you received and want to reply to…'
                                : 'Paste the message you want to rewrite or paraphrase…'
                            }
                            className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" />
                        </div>

                        {/* Context for reply */}
                        {composeMode === 'reply' && (
                          <div className="grid grid-cols-2 gap-2.5">
                            {([
                              { key: 'candidate_name', label: 'Candidate Name',  placeholder: 'Priya Sharma' },
                              { key: 'role_title',      label: 'Role Title',      placeholder: 'Senior Engineer' },
                              { key: 'company_name',    label: 'Company Name',    placeholder: 'SRP AI Labs' },
                              { key: 'recruiter_name',  label: 'Recruiter Name',  placeholder: 'Rahul' },
                            ] as const).map(({ key, label, placeholder }) => (
                              <div key={key}>
                                <label className="text-xs text-gray-400 font-medium mb-1 block">{label}</label>
                                <input value={composeFields[key]} onChange={e => setComposeFields(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={placeholder}
                                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Platform + Tone — always shown in Panel B */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Platform</label>
                            <select value={platform} onChange={e => setPlatform(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-purple-500">
                              {['Gmail', 'LinkedIn', 'WhatsApp', 'Outlook', 'Telegram'].map(p => <option key={p} className="bg-[#1a1a2e] text-gray-200">{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Tone</label>
                            <select value={tone} onChange={e => setTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-purple-500">
                              {['formal', 'professional', 'semi-formal', 'friendly', 'casual'].map(t => <option key={t} className="bg-[#1a1a2e] text-gray-200">{t}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 font-medium mb-1 block">Extra instructions (optional)</label>
                          <input value={composeFields.custom_notes} onChange={e => setComposeFields(p => ({ ...p, custom_notes: e.target.value }))}
                            placeholder="e.g. keep it under 3 sentences, mention the referral bonus…"
                            className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Generate button (always visible) ── */}
                {true && (
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={runCompose}
                      disabled={composing || (composeMode !== 'generate' && !rawInput.trim())}
                      className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                        composeMode === 'generate'
                          ? 'bg-indigo-600 hover:bg-indigo-500'
                          : 'bg-purple-600 hover:bg-purple-500'
                      }`}>
                      {composing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Composing…</>
                        : composeMode === 'generate'
                          ? <><Sparkles className="w-4 h-4" /> Generate Email</>
                          : composeMode === 'rewrite'
                            ? <><RefreshCw className="w-4 h-4" /> Rewrite Message</>
                            : composeMode === 'paraphrase'
                              ? <><RefreshCw className="w-4 h-4" /> Paraphrase</>
                              : <><Send className="w-4 h-4" /> Draft Reply</>
                      }
                    </button>
                    {composeOutput && (
                      <>
                        <button onClick={copyOutput}
                          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                          {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                        </button>
                        <button onClick={runCompose}
                          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                        </button>
                      </>
                    )}
                    {composeError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {composeError}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Output panel ── */}
                <div className={`rounded-2xl border transition-all ${
                  composeOutput ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01]'
                }`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Output</span>
                      {composeOutput && (
                        <span className="text-xs text-gray-600">· {composeOutput.split(' ').length} words</span>
                      )}
                    </div>
                    {composeMode !== 'generate' && composeOutput && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                        {composeMode === 'reply' ? 'Reply drafted' : composeMode === 'paraphrase' ? 'Paraphrased' : 'Rewritten'}
                      </span>
                    )}
                  </div>
                  <div className={`px-5 py-5 text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] ${
                    composeOutput ? 'text-gray-200' : 'text-gray-700 flex items-center justify-center'
                  }`}>
                    {composeOutput || (
                      <div className="text-center py-4 w-full">
                        <Mail className="w-8 h-8 text-gray-800 mx-auto mb-2" />
                        <p className="text-gray-600 text-xs">
                          {composeMode === 'generate'
                            ? 'Choose an email type and fill in details, then click Generate'
                            : 'Paste a message in the panel above, then click the action button'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── JOBS ─────────────────────────────────────────────────────── */}
            {activeTab === 'jobs' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-xl font-bold text-white">Job Posts</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{jobs.length} active jobs</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={seedDemo} disabled={seedingDemo}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-semibold text-purple-300 transition-all disabled:opacity-50">
                      {seedingDemo ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</> : <><Sparkles className="w-3.5 h-3.5" /> Load Demo Data</>}
                    </button>
                    <button onClick={() => setShowNewJob(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all">
                      <Plus className="w-3.5 h-3.5" /> New Job
                    </button>
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
                        <div key={job.id}
                          onClick={() => openJobDetails(job)}
                          className="glass-card rounded-xl p-5 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            <ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {job.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-base mb-1">{job.title}</h3>
                          <p className="text-sm text-gray-400">{job.company}{job.location && ` · ${job.location}`}</p>
                          {(job.description || job.requirements) && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-3 whitespace-pre-wrap">
                              {job.description || job.requirements}
                            </p>
                          )}
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3.5 h-3.5" />
                              {jobCands.length} candidates
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={(e) => { e.stopPropagation(); openJobDetails(job) }}
                                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                                <Sparkles className="w-3 h-3" /> {job.post_contents ? 'View JD & Posts ✓' : 'Open JD Details'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedJob(job.id); setActiveTab('pipeline') }}
                                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                                View pipeline <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
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

                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Candidates', value: totalCandidates,  icon: Users,       color: 'text-indigo-400' },
                    { label: 'Hired',             value: hiredCount,        icon: CheckCircle, color: 'text-green-400' },
                    { label: 'Interviews',        value: interviewCount,    icon: Clock,       color: 'text-amber-400' },
                    { label: 'Conversion Rate',   value: totalCandidates > 0 ? `${Math.round((hiredCount / totalCandidates) * 100)}%` : '0%', icon: TrendingUp, color: 'text-purple-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="glass-card rounded-xl p-5 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-3xl font-extrabold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Hiring funnel */}
                <div className="glass-card rounded-xl p-5 border border-white/5 mb-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Hiring Funnel</h2>
                  <div className="space-y-3">
                    {PIPELINE_STAGES.map(s => {
                      const count = stageCounts[s.key] ?? 0
                      const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0
                      return (
                        <div key={s.key} className="flex items-center gap-3">
                          <span className={`text-xs w-20 font-medium ${s.text}`}>{s.label}</span>
                          <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${s.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                          <span className="text-xs text-gray-600 w-10 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI match distribution */}
                <div className="glass-card rounded-xl p-5 border border-white/5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">AI Match Distribution</h2>
                  <div className="space-y-3">
                    {(['best', 'good', 'partial', 'poor'] as const).map(m => {
                      const count = candidates.filter(c => c.match_category === m).length
                      const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0
                      const cfg = MATCH_CONFIG[m]
                      return (
                        <div key={m} className="flex items-center gap-3">
                          <span className={`text-xs w-24 font-medium ${cfg.text}`}>{cfg.label}</span>
                          <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bg.replace('/20', '/60')}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                          <span className="text-xs text-gray-600 w-10 text-right">{pct}%</span>
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
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <h2 className="text-lg font-bold text-white">New Job Post</h2>
              <button onClick={() => setShowNewJob(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {([
                { key: 'title',    label: 'Job Title *',  placeholder: 'e.g. Senior Software Engineer' },
                { key: 'company',  label: 'Company',      placeholder: 'e.g. SRP AI Labs' },
                { key: 'location', label: 'Location',     placeholder: 'e.g. Hyderabad / Remote' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={newJob[key]} onChange={e => setNewJob(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select value={newJob.type} onChange={e => setNewJob(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                  {['full-time', 'part-time', 'contract', 'remote', 'internship'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* JD File Upload */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Upload JD File (auto-fills fields below)</label>
                <FileUploadZone label="Drop JD — PDF / DOCX / TXT" accept=".pdf,.docx,.doc,.txt" multiple={false}
                  onTexts={([t]) => {
                    // Smart split: first half → description, second half → requirements
                    const text = t.text
                    const mid = Math.floor(text.length / 2)
                    const splitAt = text.indexOf('\n', mid)
                    const descPart = text.slice(0, splitAt > 0 ? splitAt : mid).trim()
                    const reqPart  = text.slice(splitAt > 0 ? splitAt : mid).trim()
                    setNewJob(p => ({
                      ...p,
                      description:  descPart.slice(0, 1000),
                      requirements: reqPart.slice(0, 800),
                    }))
                  }} />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Role overview — or upload a JD file above to auto-fill…"
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Requirements</label>
                <textarea value={newJob.requirements} onChange={e => setNewJob(p => ({ ...p, requirements: e.target.value }))}
                  rows={3} placeholder="Key skills and experience required…"
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 flex-shrink-0">
              <button onClick={() => setShowNewJob(false)} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-gray-400 hover:bg-white/10">Cancel</button>
              <button onClick={createJob} disabled={savingJob || !newJob.title}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50 transition-colors">
                {savingJob ? 'Creating…' : 'Create Job'}
              </button>
              <button onClick={createAndGenerate} disabled={savingJob || !newJob.title}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Create & Generate Posts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Job Posts Modal ─────────────────────────────────────── */}
      {genPostJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Job Details & Social Posts</h2>
                <p className="text-xs text-gray-500 mt-0.5">{genPostJob.title}{genPostJob.company ? ` · ${genPostJob.company}` : ''}{genPostJob.short_id ? ` · ${genPostJob.short_id}` : ''}</p>
              </div>
              <button onClick={() => setGenPostJob(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            {/* Source JD preview */}
            <div className="mb-4 grid grid-cols-1 gap-3 flex-shrink-0">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Job Description</label>
                  {Object.keys(generatedPosts).length > 0 && (
                    <span className="text-[11px] text-emerald-400">Saved posts loaded — no AI cost unless you click Regenerate</span>
                  )}
                </div>
                <div className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-gray-300">
                  {genPostJob.description?.trim() || 'No description saved for this job yet.'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1 block">Requirements</label>
                <div className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-gray-300">
                  {genPostJob.requirements?.trim() || 'No requirements saved for this job yet.'}
                </div>
              </div>
            </div>

            {/* Custom prompt */}
            <div className="mb-4 flex-shrink-0">
              <label className="text-xs text-gray-500 mb-1 block">Extra context / instructions (optional)</label>
              <input value={genCustomPrompt} onChange={e => setGenCustomPrompt(e.target.value)}
                placeholder="e.g. Highlight remote work, mention 5LPA stipend, target freshers…"
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
            </div>

            <button
              onClick={() => generateJobPosts(genPostJob)}
              disabled={generatingPosts}
              className="mb-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-sm transition-all disabled:opacity-50 flex-shrink-0">
              {generatingPosts
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating for all platforms…</>
                : Object.keys(generatedPosts).length > 0
                  ? <><Sparkles className="w-4 h-4" /> Regenerate Posts</>
                  : <><Sparkles className="w-4 h-4" /> Generate Posts from Full JD</>
              }
            </button>

            {genPostError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-3 flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {genPostError}
              </div>
            )}

            {Object.keys(generatedPosts).length > 0 && (
              <div className="flex flex-col min-h-0 flex-1">
                {/* Platform tabs */}
                <div className="flex gap-1 flex-wrap mb-3 flex-shrink-0">
                  {(['linkedin', 'whatsapp', 'email', 'twitter', 'indeed', 'telegram', 'facebook'] as const).map(p => (
                    generatedPosts[p] && (
                      <button key={p} onClick={() => setGenPostTab(p)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${genPostTab === p ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                        {p === 'twitter' ? 'Twitter/X' : p === 'facebook' ? 'Facebook' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    )
                  ))}
                </div>
                {/* Post content */}
                <div className="relative flex-1 min-h-0">
                  <textarea
                    readOnly
                    value={generatedPosts[genPostTab] ?? ''}
                    rows={10}
                    className="w-full h-full min-h-[200px] px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 resize-none focus:outline-none" />
                  <button
                    onClick={() => copyPostContent(genPostTab, generatedPosts[genPostTab] ?? '')}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-gray-300 transition-all">
                    {copiedPostKey === genPostTab ? <><Check className="w-3 h-3 text-green-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>
            )}
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
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assign to Job (optional)</label>
                <select value={newCand.job_post_id} onChange={e => setNewCand(p => ({ ...p, job_post_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
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

// ── ScoreRing ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100)
  const color = score >= 75 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fill: color, fontSize: size * 0.22, fontWeight: 700 }}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

// ── FileUploadZone ────────────────────────────────────────────────────────────
function FileUploadZone({ label, accept, multiple, onTexts, disabled }: {
  label: string; accept: string; multiple: boolean
  onTexts: (items: Array<{ text: string; filename: string }>) => void; disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [parseError, setParseError] = useState('')

  const parseFiles = async (files: FileList) => {
    setParsing(true); setParseError(''); setNames([])
    const results: Array<{ text: string; filename: string }> = []
    let lastError = ''
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file)
      try {
        const res = await fetch('/api/parse', { method: 'POST', body: fd })
        const d = await res.json()
        if (res.ok && d.text) {
          results.push({ text: d.text, filename: file.name })
        } else {
          lastError = d.error ?? `Failed to parse ${file.name}`
        }
      } catch (e) {
        lastError = `Network error: ${String(e)}`
      }
    }
    setParsing(false)
    if (results.length > 0) {
      setNames(results.map(r => r.filename))
      onTexts(results)
    } else {
      setParseError(lastError || 'No files could be parsed')
    }
  }

  return (
    <div className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
      dragging ? 'border-indigo-500 bg-indigo-500/10' : parseError ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
    } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragEnter={e => { e.preventDefault(); setDragging(true) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { e.preventDefault(); setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) parseFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => { if (e.target.files?.length) parseFiles(e.target.files) }} />
      {parsing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-indigo-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Parsing…
        </div>
      ) : parseError ? (
        <div>
          <AlertCircle className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <p className="text-xs text-red-400">{parseError}</p>
          <p className="text-xs text-gray-600 mt-0.5">Click to try again</p>
        </div>
      ) : names.length > 0 ? (
        <div>
          <CheckCircle className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-xs text-green-400 font-medium">{names.length} file{names.length > 1 ? 's' : ''} loaded</p>
          {names.slice(0, 3).map(n => <p key={n} className="text-xs text-gray-500 truncate">{n}</p>)}
          {names.length > 3 && <p className="text-xs text-gray-600">+{names.length - 3} more</p>}
        </div>
      ) : (
        <div>
          <Upload className="w-5 h-5 text-gray-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xs text-gray-700 mt-0.5">Click or drag & drop</p>
        </div>
      )}
    </div>
  )
}

// ── ScreenResultCard ──────────────────────────────────────────────────────────
function ScreenResultCard({ result: r }: { result: ScreenResult; onAddCandidate: (id?: string) => void }) {
  const [open, setOpen] = useState(false)
  const decisionColor = r.decision === 'Shortlisted' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : r.decision === 'On Hold' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20'
  // normalise field names — AI returns candidate_strengths, candidate_weaknesses, low_or_missing_match_skills
  const ev = r.evaluation
  const strengths = ev?.candidate_strengths ?? ev?.strengths ?? []
  const weaknesses = ev?.candidate_weaknesses ?? ev?.weaknesses ?? []
  const missingSkills = ev?.low_or_missing_match_skills ?? ev?.missing_skills ?? []
  const highSkills = ev?.high_match_skills ?? []
  return (
    <div className="glass-card rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all">
      <div className="flex items-center gap-4">
        <ScoreRing score={r.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-white">{r.name || 'Unknown'}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${decisionColor}`}>{r.decision}</span>
            {r.short_id && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono">
                ✓ Saved · {r.short_id}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{r.email}{r.contact_number ? ` · ${r.contact_number}` : ''}</p>
          {r.current_company && <p className="text-xs text-gray-600">{r.current_company}</p>}
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-gray-600 hover:text-gray-400 transition-colors ml-auto">
          <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {open && ev && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3 text-xs">
          {highSkills.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Matched Skills</p>
              <div className="flex flex-wrap gap-1">{highSkills.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{s}</span>)}</div>
            </div>
          )}
          {strengths.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Strengths</p>
              <ul className="space-y-0.5">{strengths.map((s, i) => <li key={i} className="text-emerald-400">✓ {s}</li>)}</ul>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Weaknesses</p>
              <ul className="space-y-0.5">{weaknesses.map((s, i) => <li key={i} className="text-amber-400">△ {s}</li>)}</ul>
            </div>
          )}
          {missingSkills.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Missing / Low Match Skills</p>
              <div className="flex flex-wrap gap-1">{missingSkills.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">{s}</span>)}</div>
            </div>
          )}
          {ev.risk_level && (
            <p className="text-gray-500">Risk: <span className="text-amber-400">{ev.risk_level}</span>{ev.risk_explanation ? ` — ${ev.risk_explanation}` : ''}</p>
          )}
          {ev.justification && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Justification</p>
              <p className="text-gray-400 leading-relaxed">{ev.justification}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── KanbanCard ────────────────────────────────────────────────────────────────
function KanbanCard({ candidate: c, onMove, dragging, onDragStart, onDragEnd }: {
  candidate: Candidate; onMove: (id: string, stage: string) => void
  dragging: boolean; onDragStart: () => void; onDragEnd: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className={`bg-white/[0.03] border rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all select-none ${
        dragging ? 'opacity-40 border-indigo-500/50 scale-95' : 'border-white/5 hover:border-indigo-500/20'
      }`}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
            {c.candidate_name?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{c.candidate_name}</p>
            <p className="text-[10px] text-gray-600 truncate">{c.candidate_email}</p>
          </div>
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
          <p className="text-[10px] text-gray-600 mb-1">Move to:</p>
          <div className="flex flex-wrap gap-1">
            {PIPELINE_STAGES.filter(s => s.key !== c.pipeline_stage).map(s => (
              <button key={s.key} onClick={() => onMove(c.id, s.key)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${s.color} ${s.text} hover:opacity-80`}>
                {s.label}
              </button>
            ))}
          </div>
          {c.ai_summary && <p className="text-[10px] text-gray-600 mt-1.5 line-clamp-2">{c.ai_summary}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {(c.ai_skills ?? []).slice(0, 4).map(s => (
              <span key={s} className="text-[10px] bg-white/5 text-gray-500 px-1 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
