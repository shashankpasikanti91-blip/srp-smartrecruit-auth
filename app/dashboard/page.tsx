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
  MoreVertical, Send, Loader2, Download, Settings, User as UserIcon, CreditCard, Activity, Shield,
  Key, Pencil, Eye, EyeOff, Link2, Trash2, ToggleLeft, ToggleRight, ExternalLink
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
  candidate_phone: string | null
  ai_score: number | null
  match_category: 'best' | 'good' | 'partial' | 'poor' | null
  pipeline_stage: string; status: string; ai_skills: string[]; ai_summary: string
  raw_text: string | null; file_name: string | null
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
  { key: 'sourced',    label: 'Sourced',    color: 'bg-slate-700',      text: 'text-slate-300',   bar: 'bg-slate-400',      icon: Inbox },
  { key: 'applied',   label: 'Applied',    color: 'bg-blue-900/60',    text: 'text-blue-300',    bar: 'bg-blue-500',       icon: Briefcase },
  { key: 'screening', label: 'Screening',  color: 'bg-purple-900/60',  text: 'text-purple-300',  bar: 'bg-purple-500',     icon: Target },
  { key: 'interview', label: 'Interview',  color: 'bg-amber-900/60',   text: 'text-amber-300',   bar: 'bg-amber-500',      icon: Clock },
  { key: 'offer',     label: 'Offer',      color: 'bg-emerald-900/60', text: 'text-emerald-300', bar: 'bg-emerald-500',    icon: CheckCircle },
  { key: 'hired',     label: 'Hired',      color: 'bg-green-900/60',   text: 'text-green-300',   bar: 'bg-green-500',      icon: Star },
]

const MATCH_CONFIG = {
  best:    { label: 'Best Match',    bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  good:    { label: 'Good Match',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    bar: 'bg-blue-500' },
  partial: { label: 'Partial Match', bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-500' },
  poor:    { label: 'Low Match',     bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-500' },
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

  const [activeTab, setActiveTab] = useState<'pipeline' | 'candidates' | 'screen' | 'compose' | 'jobs' | 'analytics' | 'settings'>('pipeline')
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterMatch, setFilterMatch] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({})
  const [topSkills, setTopSkills] = useState<Array<{ skill: string; count: number }>>([])

  // New Job modal state
  const [showNewJob, setShowNewJob] = useState(false)
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '' })
  const [savingJob, setSavingJob] = useState(false)


  // New Candidate modal state
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [newCand, setNewCand] = useState({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '' })
  const [savingCand, setSavingCand] = useState(false)
  const [candResumeFile, setCandResumeFile] = useState<File | null>(null)
  const [candResumeParsing, setCandResumeParsing] = useState(false)
  const [candResumeText, setCandResumeText] = useState('')
  const [candResumeError, setCandResumeError] = useState('')

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

  // Upgrade prompt state
  const [upgradePrompt, setUpgradePrompt] = useState<{ show: boolean; message: string; feature: string }>({ show: false, message: '', feature: '' })
  const [subAlertDismissed, setSubAlertDismissed] = useState(false)

  // Profile / Settings state
  const [profileData, setProfileData] = useState<{
    user: { id: string; name: string; email: string; image: string | null; provider: string; role: string; created_at: string }
    subscription: { plan: string; status: string; billing_cycle: string; current_period_end: string | null; trial_ends_at: string | null }
    usage: { screens_this_month: number; composes_this_month: number; total_candidates: number; active_jobs: number }
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [apiKeys, setApiKeys] = useState<{ key_prefix: string; label: string; is_active: boolean; created_at: string }[]>([])
  const [generatedKey, setGeneratedKey] = useState('')
  const [generatingKey, setGeneratingKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [integrations, setIntegrations] = useState<{ provider: string; webhook_url: string | null; config: Record<string, string>; is_active: boolean; has_api_key: boolean; created_at: string }[]>([])
  const [intgProvider, setIntgProvider] = useState('')
  const [intgApiKey, setIntgApiKey] = useState('')
  const [intgWebhook, setIntgWebhook] = useState('')
  const [savingIntg, setSavingIntg] = useState(false)

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
      const jobFilter = filterJob || selectedJob
      if (jobFilter) params.set('job_id', jobFilter)
      if (filterSkill) params.set('skill', filterSkill)

      const [jRes, cRes] = await Promise.all([
        fetch('/api/jobs').catch(() => null),
        fetch(`/api/candidates?${params.toString()}`).catch(() => null),
      ])
      if (jRes?.ok) {
        const jData = await jRes.json()
        setJobs(jData.jobs ?? [])
      }
      if (cRes?.ok) {
        const cData = await cRes.json()
        setCandidates(cData.candidates ?? [])
        setStageCounts(cData.stageCounts ?? {})
        setMatchCounts(cData.matchCounts ?? {})
        setTopSkills(cData.topSkills ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [searchQ, filterStage, filterMatch, filterJob, filterSkill, selectedJob])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status, loadData])

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setProfileData(data)
      } else {
        console.error('[profile] HTTP', res.status, await res.text().catch(() => ''))
        // profileData stays null → shows error UI with Retry button
      }
    } catch (e) {
      console.error('[profile] fetch error:', e)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  // Load profile eagerly for subscription alerts on any tab
  useEffect(() => {
    if (status === 'authenticated' && !profileData) loadProfile()
  }, [status, profileData, loadProfile])

  const saveName = async () => {
    if (!editName.trim()) return
    setSavingName(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        setProfileData(prev => prev ? { ...prev, user: { ...prev.user, name: editName.trim() } } : prev)
        setEditingName(false)
      }
    } finally { setSavingName(false) }
  }

  const loadApiKeys = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_api_keys' }),
      })
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.keys ?? [])
      }
    } catch { /* ignore */ }
  }

  const generateApiKey = async () => {
    setGeneratingKey(true); setGeneratedKey('')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_api_key', label: 'Default' }),
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedKey(data.api_key)
        setShowKey(true)
        await loadApiKeys()
      }
    } finally { setGeneratingKey(false) }
  }

  const revokeApiKey = async () => {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_api_key' }),
    })
    setGeneratedKey('')
    await loadApiKeys()
  }

  const loadIntegrations = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_integrations' }),
      })
      if (res.ok) {
        const data = await res.json()
        setIntegrations(data.integrations ?? [])
      }
    } catch { /* ignore */ }
  }

  const saveIntegration = async () => {
    if (!intgProvider) return
    setSavingIntg(true)
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_integration',
          provider: intgProvider,
          api_key: intgApiKey || undefined,
          webhook_url: intgWebhook || undefined,
        }),
      })
      setIntgProvider(''); setIntgApiKey(''); setIntgWebhook('')
      await loadIntegrations()
    } finally { setSavingIntg(false) }
  }

  const deleteIntegration = async (provider: string) => {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_integration', provider }),
    })
    await loadIntegrations()
  }

  const toggleIntegration = async (provider: string, is_active: boolean) => {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_integration', provider, is_active }),
    })
    await loadIntegrations()
  }

  useEffect(() => {
    if (activeTab === 'settings') { loadApiKeys(); loadIntegrations() }
  }, [activeTab])

  const createJob = async () => {
    if (!newJob.title) return
    setSavingJob(true)
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newJob) })
    if (res.status === 403) {
      const data = await res.json()
      setSavingJob(false)
      setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Posts' })
      return
    }
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
    if (res.status === 403) {
      setSavingJob(false)
      setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Posts' })
      return
    }
    setSavingJob(false)
    setShowNewJob(false)
    setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '' })
    await loadData()
    if (data.job) {
      setGenPostJob(data.job)
      setGeneratedPosts({}); setGenCustomPrompt(''); setGenPostError('')
    }
  }



  const handleCandResumeUpload = async (file: File) => {
    setCandResumeFile(file)
    setCandResumeError('')
    setCandResumeText('')
    setCandResumeParsing(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setCandResumeError(data.error ?? 'Failed to parse resume'); return }
      setCandResumeText(data.text ?? '')
      // Auto-fill name/email/phone from parsed text if fields are empty
      if (!newCand.candidate_name) {
        const nameMatch = data.text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/m)
        if (nameMatch) setNewCand(p => ({ ...p, candidate_name: nameMatch[1] }))
      }
    } catch { setCandResumeError('Network error — please try again') }
    finally { setCandResumeParsing(false) }
  }

  const createCandidate = async () => {
    if (!newCand.candidate_name) return
    setSavingCand(true)
    const payload = {
      ...newCand,
      ai_skills: newCand.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
      raw_text: candResumeText || undefined,
      file_name: candResumeFile?.name || undefined,
      file_size_bytes: candResumeFile?.size || undefined,
    }
    await fetch('/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSavingCand(false)
    setShowNewCandidate(false)
    setNewCand({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '' })
    setCandResumeFile(null); setCandResumeText(''); setCandResumeError('')
    loadData()
  }

  const moveStage = async (candidateId: string, stage: string) => {
    // Optimistic update
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, pipeline_stage: stage } : c))
    setSelectedCandidate(prev => prev?.id === candidateId ? { ...prev, pipeline_stage: stage } : prev)
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

  const changeJob = async (candidateId: string, jobId: string) => {
    const job = jobId ? jobs.find(j => j.id === jobId) : null
    const jp = job ? { id: job.id, short_id: job.short_id, title: job.title, company: job.company } : null
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, job_posts: jp } : c))
    setSelectedCandidate(prev => prev?.id === candidateId ? { ...prev, job_posts: jp } : prev)
    await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_post_id: jobId || null }),
    })
  }

  const runScreening = async () => {
    setScreening(true); setScreenError(''); setScreenResults([])
    try {
      const resumes = screenMode === 'single'
        ? [{ text: resumeText, filename: 'pasted_resume' }]
        : bulkTexts
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 150000) // 150s timeout
      try {
        const res = await fetch('/api/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jd_text: jdText, resumes, job_post_id: screenJobId || undefined }),
          signal: controller.signal,
        })
        clearTimeout(timer)
        const data = await res.json()
        if (res.status === 403) {
          setUpgradePrompt({ show: true, message: data.error || 'You have reached your AI screening limit.', feature: 'AI Screening' })
          return
        }
        if (!res.ok) { setScreenError(data.error ?? 'Screening failed'); return }
        setScreenResults(data.results ?? [])
        if ((data.results?.length ?? 0) > 0) {
          await loadData()
        }
      } catch (fetchErr) {
        clearTimeout(timer)
        throw fetchErr
      }
    } catch (e) {
      const msg = String(e)
      if (msg.includes('AbortError') || msg.includes('aborted')) {
        setScreenError('Screening is taking longer than expected. Please try again in a moment.')
      } else if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
        setScreenError('Server is temporarily busy. Please wait a few seconds and try again.')
      } else {
        setScreenError(msg)
      }
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
      if (res.status === 403) {
        setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Post Generation' })
        return
      }
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

  // Subscription expiry alert logic
  const subAlert = (() => {
    if (!profileData?.subscription) return null
    const { plan, billing_cycle, current_period_end, status: subStatus } = profileData.subscription
    if (plan === 'free' || subStatus === 'cancelled') return null
    if (!current_period_end) return null
    const now = new Date()
    const end = new Date(current_period_end)
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) {
      return { level: 'expired' as const, daysLeft, billing_cycle, message: `Your ${plan} subscription has expired. Renew now to continue using all features.` }
    }
    if (billing_cycle === 'yearly') {
      if (daysLeft <= 7) return { level: 'urgent' as const, daysLeft, billing_cycle, message: `Your yearly ${plan} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to avoid interruption.` }
      if (daysLeft <= 30) return { level: 'warning' as const, daysLeft, billing_cycle, message: `Your yearly ${plan} plan expires in ${daysLeft} days. Consider renewing soon.` }
    } else {
      if (daysLeft <= 3) return { level: 'urgent' as const, daysLeft, billing_cycle, message: `Your monthly ${plan} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to avoid losing access.` }
      if (daysLeft <= 7) return { level: 'warning' as const, daysLeft, billing_cycle, message: `Your monthly ${plan} plan expires in ${daysLeft} days. Renew to continue unlimited access.` }
    }
    return null
  })()

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="flex h-screen overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: '#0B1F3A', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none tracking-tight">SRP Recruit AI Labs</p>
                <p className="text-[11px] leading-none mt-0.5" style={{ color: '#4A90D9' }}>SmartRecruit</p>
              </div>
            </div>
          </div>

          {/* Sidebar plan badge */}
          {profileData?.subscription && profileData.subscription.plan !== 'free' && (
            <div className="mx-3 mt-3 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.25)' }}>
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold capitalize" style={{ color: '#7EB3FF' }}>{profileData.subscription.plan} Plan</span>
            </div>
          )}
          {profileData?.subscription?.plan === 'free' && (
            <button onClick={() => setUpgradePrompt({ show: true, message: 'Unlock unlimited AI screenings, job posts, and all premium features.', feature: 'Pro Plan' })}
              className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 transition-all group"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-amber-300">Upgrade to Pro</span>
            </button>
          )}

          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {([
              { tab: 'pipeline',   icon: Layers,      label: 'Pipeline',   badge: null },
              { tab: 'candidates', icon: Users,        label: 'Candidates', badge: null },
              { tab: 'screen',     icon: Brain,        label: 'AI Screen',  badge: 'AI' },
              { tab: 'compose',    icon: Mail,         label: 'Compose',    badge: 'AI' },
              { tab: 'jobs',       icon: Briefcase,    label: 'Jobs',       badge: null },
              { tab: 'analytics',  icon: BarChart3,    label: 'Analytics',  badge: null },
              { tab: 'settings',   icon: Settings,     label: 'Settings',   badge: null },
            ] as const).map(({ tab, icon: Icon, label, badge }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={activeTab === tab
                  ? { background: '#1E4E8C', color: '#FFFFFF' }
                  : { color: '#B8C7E0' }}
                onMouseEnter={e => { if (activeTab !== tab) { (e.currentTarget as HTMLButtonElement).style.background = '#16345F'; (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF' } }}
                onMouseLeave={e => { if (activeTab !== tab) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#B8C7E0' } }}>
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{label}</span>
                {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.3)', color: '#C4B5FD' }}>{badge}</span>}
              </button>
            ))}

            {isOwner && (
              <button onClick={() => router.push('/owner')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all mt-4 border border-amber-500/20">
                <Crown className="w-4 h-4" /> Owner Panel
              </button>
            )}
          </nav>

          <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              {user?.image
                ? <img src={user.image} alt="" className="w-8 h-8 rounded-full ring-2" style={{ ringColor: 'rgba(74,144,217,0.4)' }} />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1E4E8C' }}>{user?.name?.[0] ?? '?'}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[11px] truncate" style={{ color: '#7EB3FF' }}>{user?.email}</p>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/15 text-sm font-medium transition-all"
              style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {/* Subscription expiry alert banner */}
          {subAlert && !subAlertDismissed && (
            <div className={`px-6 py-3 flex items-center justify-between gap-4 ${
              subAlert.level === 'expired' ? 'bg-red-600/20 border-b border-red-500/30' :
              subAlert.level === 'urgent' ? 'bg-amber-600/20 border-b border-amber-500/30' :
              'bg-yellow-600/15 border-b border-yellow-500/20'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                {subAlert.level === 'expired' ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> :
                 subAlert.level === 'urgent' ? <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" /> :
                 <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                <p className={`text-sm font-medium ${
                  subAlert.level === 'expired' ? 'text-red-300' :
                  subAlert.level === 'urgent' ? 'text-amber-300' : 'text-yellow-300'
                }`}>
                  {subAlert.message}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href="mailto:pasikantishashank24@gmail.com?subject=Renew%20Subscription%20-%20SRP%20SmartRecruit&body=Hi%2C%20I%27d%20like%20to%20renew%20my%20subscription.%0A%0AEmail%3A%20"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    subAlert.level === 'expired' ? 'bg-red-600 hover:bg-red-500 text-white' :
                    'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}>
                  <Zap className="w-3 h-3" /> Renew Now
                </a>
                {subAlert.level !== 'expired' && (
                  <button onClick={() => setSubAlertDismissed(true)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Free plan usage warning banner */}
          {profileData?.subscription?.plan === 'free' && profileData.usage && (
            (profileData.usage.active_jobs >= 4 || profileData.usage.screens_this_month >= 15) && !subAlertDismissed
          ) && (
            <div className="px-6 py-3 flex items-center justify-between gap-4 bg-amber-600/15 border-b border-amber-500/20">
              <div className="flex items-center gap-3 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm font-medium text-amber-300">
                  {profileData.usage.active_jobs >= 4
                    ? `You've used ${profileData.usage.active_jobs} of 5 free job posts.`
                    : `You've used ${profileData.usage.screens_this_month} of 20 free AI screens this month.`}
                  {' '}Upgrade to Pro for unlimited access.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setUpgradePrompt({ show: true, message: 'Unlock unlimited features with a Pro plan.', feature: 'Pro Plan' })}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Upgrade
                </button>
                <button onClick={() => setSubAlertDismissed(true)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Stats bar */}
          <div className="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center gap-5 flex-wrap">
            {[
              { icon: Briefcase,     color: 'text-[#1E4E8C]', bg: 'bg-blue-50',   label: 'Jobs',       value: jobs.length },
              { icon: Users,         color: 'text-purple-600', bg: 'bg-purple-50', label: 'Candidates', value: totalCandidates },
              { icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Interviews', value: interviewCount },
              { icon: CheckCircle,   color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Hired',      value: hiredCount },
            ].map(({ icon: Icon, color, bg, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium leading-none">{label}</p>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{value}</p>
                </div>
                <div className="w-px h-6 bg-gray-200 ml-2" />
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowNewCandidate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-sm text-gray-700 font-medium transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Candidate
              </button>
              <button onClick={() => setShowNewJob(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                style={{ background: '#0B1F3A' }}>
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
                    <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Drag & drop candidates across stages</p>
                  </div>
                  <div className="relative">
                    <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30">
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
                            isOver ? 'bg-blue-50 border-blue-400/50' : 'bg-gray-50 border-gray-200'
                          }`}>
                            {stageCands.length === 0
                              ? <p className={`text-center text-xs pt-6 ${isOver ? 'text-blue-500' : 'text-gray-400'}`}>
                                  {isOver ? 'Drop here' : 'Empty'}
                                </p>
                              : stageCands.map(c => (
                                  <KanbanCard key={c.id} candidate={c} onMove={moveStage}
                                    onOpen={setSelectedCandidate}
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
                    <h1 className="text-xl font-bold text-gray-900">Candidates</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {filterSkill ? <><span className="text-[#1E4E8C] font-semibold">{candidates.length}</span> with &quot;{filterSkill}&quot;</> : `${candidates.length} total`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                      placeholder="Name or email…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-blue-500/70" />
                    <input value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
                      placeholder="Filter by skill…"
                      list="skill-suggestions"
                      className="pl-9 pr-3 py-2 rounded-lg bg-white border border-blue-300/60 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-40" />
                    <datalist id="skill-suggestions">
                      {topSkills.map(({ skill }) => <option key={skill} value={skill} />)}
                    </datalist>
                  </div>
                  <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Stages</option>
                    {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Matches</option>
                    <option value="best">Best Match</option>
                    <option value="good">Good Match</option>
                    <option value="partial">Partial Match</option>
                  </select>
                  <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Jobs</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                  {(searchQ || filterStage || filterMatch || filterJob || filterSkill) && (
                    <button onClick={() => { setSearchQ(''); setFilterStage(''); setFilterMatch(''); setFilterJob(''); setFilterSkill('') }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                  <button onClick={loadData} className="ml-auto p-2 rounded hover:bg-gray-100">
                    <Filter className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {['ID', 'Candidate', 'Match', 'Stage', 'Job', 'Skills', 'Move Stage'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No candidates found</td></tr>
                        ) : candidates.map((c, i) => (
                          <tr key={c.id} onClick={() => setSelectedCandidate(c)} className={`border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                            <td className="px-4 py-3"><ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} /></td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{c.candidate_name}</p>
                              <p className="text-xs text-gray-500">{c.candidate_email}</p>
                            </td>
                            <td className="px-4 py-3"><MatchBadge category={c.match_category} score={c.ai_score} /></td>
                            <td className="px-4 py-3"><StagePill stage={c.pipeline_stage} /></td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {c.job_posts ? (
                                <><p>{c.job_posts.title}</p><ShortIdBadge id={c.job_posts.short_id ?? ''} /></>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[140px]">
                                {(c.ai_skills ?? []).slice(0, 3).map(s => (
                                  <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{s}</span>
                                ))}
                                {(c.ai_skills?.length ?? 0) > 3 && (
                                  <span className="text-xs text-gray-400">+{c.ai_skills.length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select defaultValue={c.pipeline_stage} onChange={e => moveStage(c.id, e.target.value)}
                                className="text-xs bg-white border border-gray-300 text-gray-600 rounded px-2 py-1 cursor-pointer focus:outline-none focus:border-blue-400">
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
                    <h1 className="text-xl font-bold text-gray-900">AI Screening</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Score & rank candidates against your job description</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {(['single', 'bulk'] as const).map(m => (
                      <button key={m} onClick={() => setScreenMode(m)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${screenMode === m ? 'bg-purple-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
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
                      <h2 className="text-sm font-semibold text-gray-700">{screenResults.length} result{screenResults.length > 1 ? 's' : ''} — saved to Candidates</h2>
                      <button onClick={() => setActiveTab('candidates')}
                        className="text-xs text-[#1E4E8C] hover:text-blue-800 underline underline-offset-2">
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
                    <h1 className="text-xl font-bold text-gray-900">AI Compose</h1>
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
                              { key: 'rejection',        label: 'Rejection' },
                              { key: 'shortlist',        label: 'Shortlist' },
                              { key: 'interview_invite', label: 'Interview Invite' },
                              { key: 'offer',            label: 'Offer Letter' },
                              { key: 'followup',         label: 'Follow-up' },
                              { key: 'technical_test',   label: 'Technical Test' },
                              { key: 'thank_you',        label: 'Thank You' },
                              { key: 'on_hold',          label: 'On Hold' },
                              { key: 'reference_check',  label: 'Reference Check' },
                              { key: 'whatsapp_followup',label: 'WhatsApp Follow-up' },
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
                        { key: 'rewrite',     label: 'Rewrite',     desc: 'Improve clarity & tone' },
                        { key: 'paraphrase',  label: 'Paraphrase',  desc: 'Same meaning, new words' },
                        { key: 'reply',       label: 'Reply',       desc: 'Compose a response' },
                      ] as const).map(({ key, label, desc }) => (
                        <button key={key} onClick={() => setComposeMode(key)}
                          className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl text-xs font-medium transition-all border ${
                            composeMode === key
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                          }`}>
                          <span className="font-semibold text-sm">{label}</span>
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
                    <h1 className="text-xl font-bold text-gray-900">Job Posts</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{jobs.length} active jobs</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowNewJob(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                      style={{ background: '#0B1F3A' }}>
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
                    <Briefcase className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">No jobs yet. Create your first job post.</p>
                    <button onClick={() => setShowNewJob(true)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90"
                      style={{ background: '#0B1F3A' }}>
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
                          className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                              {job.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-base mb-1">{job.title}</h3>
                          <p className="text-sm text-gray-500">{job.company}{job.location && ` · ${job.location}`}</p>
                          {(job.description || job.requirements) && (
                            <p className="text-xs text-gray-400 mt-2 line-clamp-3 whitespace-pre-wrap">
                              {job.description || job.requirements}
                            </p>
                          )}
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Users className="w-3.5 h-3.5" />
                              {jobCands.length} candidates
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={(e) => { e.stopPropagation(); openJobDetails(job) }}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700">
                                <Sparkles className="w-3 h-3" /> {job.post_contents ? 'View JD & Posts' : 'Open JD Details'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedJob(job.id); setActiveTab('pipeline') }}
                                className="flex items-center gap-1 text-xs hover:text-blue-800" style={{ color: '#1E4E8C' }}>
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
                <h1 className="text-xl font-bold text-gray-900 mb-6">Analytics</h1>

                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Candidates', value: totalCandidates,  icon: Users,       color: 'text-[#1E4E8C]', bg: 'bg-blue-50' },
                    { label: 'Hired',             value: hiredCount,        icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Interviews',        value: interviewCount,    icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Conversion Rate',   value: totalCandidates > 0 ? `${Math.round((hiredCount / totalCandidates) * 100)}%` : '0%', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-3xl font-extrabold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Hiring funnel */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Hiring Funnel</h2>
                  <div className="space-y-3">
                    {PIPELINE_STAGES.map(s => {
                      const count = stageCounts[s.key] ?? 0
                      const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0
                      return (
                        <div key={s.key} className="flex items-center gap-3">
                          <span className={`text-xs w-20 font-medium ${s.text}`}>{s.label}</span>
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right font-semibold">{count}</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI match distribution */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">AI Match Distribution</h2>
                  <div className="space-y-3">
                    {(['best', 'good', 'partial', 'poor'] as const).map(m => {
                      const count = matchCounts[m] ?? 0
                      const total = Object.values(matchCounts).reduce((a, b) => a + b, 0)
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0
                      const cfg = MATCH_CONFIG[m]
                      return (
                        <div key={m} className="flex items-center gap-3">
                          <span className={`text-xs w-24 font-medium ${cfg.text}`}>{cfg.label}</span>
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right font-semibold">{count}</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Top Skills chart */}
                {topSkills.length > 0 && (
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mt-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-700">Top Skills Across All Candidates</h2>
                      <span className="text-xs text-gray-400">{topSkills.length} unique skills tracked</span>
                    </div>
                    <div className="space-y-2">
                      {topSkills.map(({ skill, count }) => {
                        const pct = Math.round((count / topSkills[0].count) * 100)
                        return (
                          <div key={skill} className="flex items-center gap-3">
                            <button
                              onClick={() => { setFilterSkill(skill); setActiveTab('candidates') }}
                              className="text-xs text-gray-700 w-36 truncate text-left hover:text-[#1E4E8C] transition-colors"
                              title={`Click to filter candidates with ${skill}`}>
                              {skill}
                            </button>
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#1E4E8C] transition-all" style={{ width: `${Math.max(pct, 3)}%` }} />
                            </div>
                            <span className="text-xs text-gray-600 w-8 text-right font-semibold">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Click any skill name to jump to filtered candidate list.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS ─────────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <div className="max-w-3xl">
                <h1 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h1>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-[#1E4E8C]" />
                  </div>
                ) : profileData ? (
                  <div className="space-y-5">

                    {/* Profile Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-[#1E4E8C]" />
                          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Profile</h2>
                        </div>
                        {!editingName && (
                          <button onClick={() => { setEditName(profileData.user.name || ''); setEditingName(true) }}
                            className="flex items-center gap-1 text-xs text-[#1E4E8C] hover:text-blue-800 transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-5">
                        {profileData.user.image
                          ? <img src={profileData.user.image} alt="" className="w-16 h-16 rounded-full ring-2 ring-blue-200" />
                          : <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ring-2 ring-blue-200" style={{ background: '#1E4E8C' }}>
                              {profileData.user.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                        }
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Full Name</p>
                              {editingName ? (
                                <div className="flex items-center gap-2">
                                  <input value={editName} onChange={e => setEditName(e.target.value)}
                                    className="w-full px-2 py-1 rounded bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                    autoFocus />
                                  <button onClick={saveName} disabled={savingName}
                                    className="px-2 py-1 rounded text-white text-xs hover:opacity-90 disabled:opacity-50"
                                    style={{ background: '#1E4E8C' }}>
                                    {savingName ? '...' : 'Save'}
                                  </button>
                                  <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-gray-900">{profileData.user.name || '—'}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Email</p>
                              <p className="text-sm text-gray-700">{profileData.user.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Sign-in Method</p>
                              <p className="text-sm text-gray-700 capitalize">{profileData.user.provider === 'credentials' ? 'Email & Password' : profileData.user.provider}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Member Since</p>
                              <p className="text-sm text-gray-700">{new Date(profileData.user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subscription Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-5">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Subscription</h2>
                      </div>
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider ${
                          profileData.subscription.plan === 'pro'
                            ? 'bg-blue-50 text-[#1E4E8C] border border-blue-200'
                            : profileData.subscription.plan === 'enterprise'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {profileData.subscription.plan === 'pro' ? 'Pro Plan' : profileData.subscription.plan === 'enterprise' ? 'Enterprise Plan' : 'Free Plan'}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          profileData.subscription.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {profileData.subscription.status === 'active' ? 'Active' : profileData.subscription.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Plan</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{profileData.subscription.plan}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Billing Cycle</p>
                          <p className="text-sm text-gray-700 capitalize">{profileData.subscription.billing_cycle || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Access Level</p>
                          <p className="text-sm text-gray-700">
                            {profileData.subscription.plan === 'free'
                              ? '20 AI screens/mo, 5 active jobs'
                              : 'Unlimited AI screens & jobs'
                            }
                          </p>
                        </div>
                      </div>
                      {profileData.subscription.plan === 'free' && (
                        <div className="mt-5 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-[#1E4E8C] flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 mb-1">Upgrade to Pro</p>
                              <p className="text-xs text-gray-600 mb-3">Unlock unlimited AI screenings, unlimited job posts, priority support, and API access.</p>
                              <div className="flex flex-wrap gap-2">
                                <a href="mailto:pasikantishashank24@gmail.com?subject=Upgrade%20to%20Pro%20Plan%20-%20SRP%20SmartRecruit&body=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20account%20to%20the%20Pro%20plan.%0A%0AEmail%3A%20" 
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all shadow-sm hover:opacity-90"
                                  style={{ background: '#0B1F3A' }}>
                                  <Zap className="w-3.5 h-3.5" /> Upgrade Now
                                </a>
                                <a href="https://srpailabs.com" target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-all">
                                  <ExternalLink className="w-3.5 h-3.5" /> View Plans
                                </a>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="text-center p-2 rounded bg-white border border-blue-100">
                              <p className="text-sm font-bold text-gray-900">∞</p>
                              <p className="text-[10px] text-gray-500">AI Screens</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white border border-blue-100">
                              <p className="text-sm font-bold text-gray-900">∞</p>
                              <p className="text-[10px] text-gray-500">Job Posts</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white border border-blue-100">
                              <p className="text-sm font-bold text-gray-900">24/7</p>
                              <p className="text-[10px] text-gray-500">Support</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {(profileData.subscription.plan === 'pro' || profileData.subscription.plan === 'enterprise') && (
                        <div className="mt-5 flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <p className="text-xs text-green-700">You have full access to all features. Thank you for being a {profileData.subscription.plan === 'pro' ? 'Pro' : 'Enterprise'} member!</p>
                        </div>
                      )}
                    </div>

                    {/* Usage Stats Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-5">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Usage This Month</h2>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'AI Screens',   value: profileData.usage.screens_this_month,  limit: profileData.subscription.plan === 'free' ? 20 : null, icon: Brain,      color: 'text-purple-600', bg: 'bg-purple-50' },
                          { label: 'AI Compose',   value: profileData.usage.composes_this_month, limit: null,                                                  icon: Mail,       color: 'text-blue-600',   bg: 'bg-blue-50' },
                          { label: 'Candidates',   value: profileData.usage.total_candidates,    limit: null,                                                  icon: Users,      color: 'text-[#1E4E8C]',  bg: 'bg-blue-50' },
                          { label: 'Active Jobs',  value: profileData.usage.active_jobs,         limit: profileData.subscription.plan === 'free' ? 5 : null,   icon: Briefcase,  color: 'text-amber-600',  bg: 'bg-amber-50' },
                        ].map(({ label, value, limit, icon: Icon, color, bg }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className={`w-6 h-6 rounded ${bg} flex items-center justify-center`}>
                                <Icon className={`w-3.5 h-3.5 ${color}`} />
                              </div>
                              <p className="text-xs text-gray-500 font-medium">{label}</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{value}</p>
                            {limit !== null && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">{value} / {limit}</span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${value >= limit ? 'bg-red-500' : 'bg-[#1E4E8C]'}`}
                                    style={{ width: `${Math.min((value / limit) * 100, 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Account Info Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-5">
                        <Shield className="w-4 h-4 text-gray-500" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Account</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Account ID</p>
                          <p className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">{profileData.user.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Role</p>
                          <p className="text-sm text-gray-700 capitalize">{profileData.user.role === 'owner' ? 'Owner' : profileData.user.role === 'pro' ? 'Pro' : profileData.user.role}</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <button onClick={() => signOut({ callbackUrl: '/login' })}
                          className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all">
                          <LogOut className="w-4 h-4" /> Sign Out of Account
                        </button>
                      </div>
                    </div>

                    {/* API Keys for n8n / ATS Integration */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-amber-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">API Integration</h2>
                      </div>
                      <p className="text-xs text-gray-500 mb-5">Generate an API key to integrate SmartRecruit with n8n, your ATS, or any external system.</p>

                      {generatedKey && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-xs text-amber-700 mb-2 font-medium">Your new API key (copy it now — it won't be shown again):</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono text-gray-800 bg-white px-3 py-2 rounded border border-amber-200 break-all">
                              {showKey ? generatedKey : '•'.repeat(40)}
                            </code>
                            <button onClick={() => setShowKey(v => !v)} className="text-gray-500 hover:text-gray-800 transition-colors">
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(generatedKey); }}
                              className="text-gray-500 hover:text-gray-800 transition-colors">
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {apiKeys.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {apiKeys.map((k, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                              <div className="flex items-center gap-3">
                                <code className="text-xs font-mono text-gray-600">{k.key_prefix}••••••••</code>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${k.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                  {k.is_active ? 'Active' : 'Revoked'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">{new Date(k.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button onClick={generateApiKey} disabled={generatingKey}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 hover:opacity-90"
                          style={{ background: '#1E4E8C' }}>
                          {generatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                          {generatingKey ? 'Generating...' : 'Generate API Key'}
                        </button>
                        {apiKeys.some(k => k.is_active) && (
                          <button onClick={revokeApiKey}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium transition-all">
                            Revoke All Keys
                          </button>
                        )}
                      </div>

                      <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Usage Example:</p>
                        <code className="text-xs font-mono text-gray-600 block">
                          curl -H &quot;Authorization: Bearer srp_your_key_here&quot; \<br />
                          &nbsp;&nbsp;https://recruit.srpailabs.com/api/screen
                        </code>
                      </div>
                    </div>

                    {/* External Integrations — n8n, Monster, Naukri, etc. */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">External Integrations</h2>
                      </div>
                      <p className="text-xs text-gray-500 mb-5">Connect your ATS, n8n workflows, or job portals like Monster, Naukri, Indeed, LinkedIn by adding their API keys or webhook URLs.</p>

                      {/* Existing integrations */}
                      {integrations.length > 0 && (
                        <div className="mb-5 space-y-2">
                          {integrations.map(intg => (
                            <div key={intg.provider} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase ${
                                  intg.provider === 'n8n' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                                  intg.provider === 'naukri' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                  intg.provider === 'monster' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                                  intg.provider === 'indeed' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
                                  intg.provider === 'linkedin' ? 'bg-sky-50 text-sky-600 border border-sky-200' :
                                  'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                  {intg.provider.slice(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 capitalize">{intg.provider}</p>
                                  <p className="text-xs text-gray-400">
                                    {intg.has_api_key ? 'API Key configured' : ''}
                                    {intg.has_api_key && intg.webhook_url ? ' • ' : ''}
                                    {intg.webhook_url ? 'Webhook set' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleIntegration(intg.provider, !intg.is_active)}
                                  className={`transition-colors ${intg.is_active ? 'text-green-600' : 'text-gray-400'}`}
                                  title={intg.is_active ? 'Disable' : 'Enable'}>
                                  {intg.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                <button onClick={() => deleteIntegration(intg.provider)}
                                  className="text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new integration form */}
                      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                        <p className="text-xs text-gray-600 font-medium">Add Integration</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Platform</label>
                            <select value={intgProvider} onChange={e => setIntgProvider(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-500">
                              <option value="">Select...</option>
                              <option value="n8n">n8n (Workflow)</option>
                              <option value="naukri">Naukri</option>
                              <option value="monster">Monster</option>
                              <option value="indeed">Indeed</option>
                              <option value="linkedin">LinkedIn</option>
                              <option value="greenhouse">Greenhouse ATS</option>
                              <option value="lever">Lever ATS</option>
                              <option value="workday">Workday</option>
                              <option value="custom">Custom ATS</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                            <input type="password" value={intgApiKey} onChange={e => setIntgApiKey(e.target.value)}
                              placeholder="Paste API key"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Webhook URL <span className="text-gray-400">(optional)</span></label>
                            <input value={intgWebhook} onChange={e => setIntgWebhook(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                          </div>
                        </div>
                        <button onClick={saveIntegration} disabled={!intgProvider || savingIntg}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all disabled:opacity-50">
                          {savingIntg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                          {savingIntg ? 'Saving...' : 'Connect Integration'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-sm">Failed to load profile data.
                    <button onClick={loadProfile} className="ml-2 text-[#1E4E8C] hover:underline">Retry</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── New Job Modal ──────────────────────────────────────────────────────── */}
      {showNewJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto flex items-start justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10 my-auto flex flex-col">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto flex items-start justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 my-auto flex flex-col">
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

            {Object.keys(generatedPosts).length > 0 ? (
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
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                <p className="font-semibold mb-1">No saved posts yet for this job.</p>
                <p className="text-xs text-amber-100/80">
                  Click <span className="font-semibold">Generate Posts from Full JD</span> once to create and save them.
                  After that, opening this job will show the saved posts without generating again.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Candidate Detail Modal ──────────────────────────────────────────── */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          jobs={jobs}
          onClose={() => setSelectedCandidate(null)}
          onStageChange={moveStage}
          onJobChange={changeJob}
        />
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

              {/* Resume Upload */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Resume (PDF / DOCX / TXT — optional)</label>
                <label className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg border border-dashed cursor-pointer transition-colors ${
                  candResumeFile
                    ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/15 bg-[#1a1a2e] text-gray-500 hover:border-indigo-500/40'
                }`}>
                  <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCandResumeUpload(f) }} />
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-sm truncate">
                    {candResumeParsing ? 'Parsing…' : candResumeFile ? candResumeFile.name : 'Click to upload resume'}
                  </span>
                </label>
                {candResumeError && <p className="mt-1 text-xs text-red-400">{candResumeError}</p>}
                {candResumeText && !candResumeError && (
                  <p className="mt-1 text-xs text-green-400">Resume parsed — {candResumeText.length.toLocaleString()} characters extracted</p>
                )}
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

      {/* ── Upgrade Plan Modal ────────────────────────────────────────────── */}
      {upgradePrompt.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-0 w-full max-w-md border border-white/10 overflow-hidden">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-6 h-6 text-amber-300" />
              </div>
              <h2 className="text-lg font-bold text-white">Upgrade Your Plan</h2>
              <p className="text-sm text-indigo-100/80 mt-1">{upgradePrompt.message}</p>
            </div>

            {/* Feature list */}
            <div className="px-6 py-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">What you get with Pro</p>
              <div className="space-y-3">
                {[
                  { icon: Sparkles, text: 'Unlimited AI Screenings', desc: 'Screen as many resumes as you need' },
                  { icon: Briefcase, text: 'Unlimited Job Posts', desc: 'Create and manage unlimited openings' },
                  { icon: Mail, text: 'AI Compose & Social Posts', desc: 'Generate content for any platform' },
                  { icon: Shield, text: 'Priority Support', desc: 'Get help when you need it most' },
                  { icon: Key, text: 'API Access', desc: 'Integrate with your existing tools' },
                ].map(({ icon: Icon, text, desc }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{text}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex gap-3">
              <button onClick={() => setUpgradePrompt({ show: false, message: '', feature: '' })}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-400 transition-colors">
                Maybe Later
              </button>
              <a href="mailto:pasikantishashank24@gmail.com?subject=Upgrade%20to%20Pro%20Plan%20-%20SRP%20SmartRecruit&body=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20account%20to%20the%20Pro%20plan.%0A%0AMy%20Email%3A%20"
                onClick={() => setUpgradePrompt({ show: false, message: '', feature: '' })}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> Upgrade Now
              </a>
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
  const [open, setOpen] = useState(true)
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
                Saved · {r.short_id}
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
              <ul className="space-y-0.5">{strengths.map((s, i) => <li key={i} className="text-emerald-400">• {s}</li>)}</ul>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-1">Weaknesses</p>
              <ul className="space-y-0.5">{weaknesses.map((s, i) => <li key={i} className="text-amber-400">• {s}</li>)}</ul>
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
function KanbanCard({ candidate: c, onMove, onOpen, dragging, onDragStart, onDragEnd }: {
  candidate: Candidate; onMove: (id: string, stage: string) => void
  onOpen: (c: Candidate) => void
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
          <div className="min-w-0 cursor-pointer" onClick={e => { e.stopPropagation(); onOpen(c) }}>
            <p className="text-xs font-semibold text-white truncate hover:text-indigo-300">{c.candidate_name}</p>
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

// ── CandidateDetailModal ──────────────────────────────────────────────────────
function CandidateDetailModal({ candidate: c, jobs, onClose, onStageChange, onJobChange }: {
  candidate: Candidate
  jobs: Job[]
  onClose: () => void
  onStageChange: (id: string, stage: string) => void
  onJobChange: (id: string, jobId: string) => void
}) {
  const [tab, setTab] = useState<'profile' | 'resume'>('profile')
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] overflow-y-auto flex items-start justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-card rounded-2xl w-full max-w-2xl border border-white/10 my-auto">

        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-white/5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-lg font-bold text-white">
            {c.candidate_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{c.candidate_name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{c.candidate_email}</p>
            {c.candidate_phone && <p className="text-sm text-gray-500">{c.candidate_phone}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <MatchBadge category={c.match_category} score={c.ai_score} />
              <StagePill stage={c.pipeline_stage} />
              <ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} />
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(['profile', 'resume'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium transition-all ${
                tab === t ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'resume' ? 'Resume / CV' : 'Profile & Actions'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="p-6 space-y-5">

            {/* Pipeline Stage */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline Stage</p>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_STAGES.map(s => (
                  <button key={s.key} onClick={() => onStageChange(c.id, s.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      c.pipeline_stage === s.key
                        ? `${s.color} ${s.text} ring-2 ring-white/20`
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assign to Job */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned Job</p>
              <select value={c.job_posts?.id ?? ''}
                onChange={e => onJobChange(c.id, e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/15 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                <option value="">— No Job Assigned —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company} ({j.short_id})</option>)}
              </select>
              <p className="text-xs text-gray-600 mt-1">Reassign this resume to a different job opening.</p>
            </div>

            {/* Skills */}
            {(c.ai_skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Extracted Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.ai_skills.map(s => (
                    <span key={s} className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Assessment */}
            {c.ai_summary && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Assessment</p>
                <p className="text-sm text-gray-300 leading-relaxed bg-white/[0.02] rounded-lg p-3 border border-white/5">{c.ai_summary}</p>
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-white/5">
              {c.file_name && (
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{c.file_name}</span>
              )}
              <span>Added {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        {tab === 'resume' && (
          <div className="p-6">
            {c.raw_text ? (
              <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap bg-[#0d0d1a] rounded-lg p-4 border border-white/5 max-h-[60vh] overflow-y-auto font-mono">
                {c.raw_text}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <FileText className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No resume text stored for this candidate</p>
                <p className="text-xs mt-1">Run AI Screening with a CV file to extract and save text</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
