'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Check, Copy, FileText, Loader2, Sparkles, TrendingUp, X,
  LayoutDashboard, Users, Send, Calendar, Award, Brain, BarChart3, PenLine,
  StickyNote, Clock, GitBranch, LineChart,
} from 'lucide-react'
import { AiFitScoreCard } from '@/components/recruitment/AiFitScoreCard'
import { InternalMatchesTab } from '@/components/jobs/InternalMatchesTab'
import { EntityNotesTimeline } from '@/components/ui/EntityNotesTimeline'
import { OwnershipPanel } from '@/components/ownership/OwnershipPanel'
import type { AiFitScores } from '@/lib/aiFitScore'
import {
  JOB_POST_PLATFORMS,
  JOB_POST_PLATFORM_META,
  type JobPostPlatform,
} from '@/lib/jobPostPlatforms'

const TABS = [
  'overview',
  'jd_document',
  'posts',
  'pipeline',
  'ranking',
  'internal_matches',
  'submissions',
  'interviews',
  'offers',
  'notes',
  'similar_jobs',
  'market',
  'timeline',
] as const

type Job360Tab = typeof TABS[number]

const TAB_LABELS: Record<Job360Tab, string> = {
  overview: 'Overview',
  jd_document: 'JD Document',
  posts: 'Posts',
  pipeline: 'Pipeline',
  ranking: 'Ranking',
  internal_matches: 'Internal Matches',
  submissions: 'Submissions',
  interviews: 'Interviews',
  offers: 'Offers',
  notes: 'Notes',
  similar_jobs: 'Similar Jobs',
  market: 'Market',
  timeline: 'Timeline',
}

const TAB_GROUPS: { label: string; tabs: Job360Tab[]; accent: string }[] = [
  { label: 'Recruitment', tabs: ['overview', 'pipeline', 'submissions', 'interviews', 'offers'], accent: 'text-blue-700' },
  { label: 'AI', tabs: ['internal_matches', 'ranking', 'posts'], accent: 'text-violet-700' },
  { label: 'Documents', tabs: ['jd_document', 'notes', 'timeline'], accent: 'text-slate-600' },
  { label: 'Insights', tabs: ['similar_jobs', 'market'], accent: 'text-teal-700' },
]

const TAB_ICONS: Partial<Record<Job360Tab, typeof LayoutDashboard>> = {
  overview: LayoutDashboard,
  pipeline: Users,
  submissions: Send,
  interviews: Calendar,
  offers: Award,
  internal_matches: Brain,
  ranking: BarChart3,
  posts: PenLine,
  jd_document: FileText,
  notes: StickyNote,
  timeline: Clock,
  similar_jobs: GitBranch,
  market: LineChart,
}

type RankedCandidate = {
  id: string
  candidate_name?: string
  ai_score?: number
  ai_fit_scores?: Partial<AiFitScores>
  pipeline_stage?: string
}

type Job360Job = {
  id: string
  short_id?: string
  title: string
  company?: string | null
  location?: string | null
  status?: string | null
  type?: string | null
  description?: string | null
  requirements?: string | null
  optional_requirements?: string | null
  raw_jd_text?: string | null
  skills_mandatory?: string[] | null
  skills_required?: string[] | null
  tags?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  max_budget?: number | null
  experience_min?: number | null
  experience_max?: number | null
  contract_duration?: string | null
  department?: string | null
  headcount?: number | null
  priority?: string | null
  hiring_manager?: string | null
  hiring_difficulty?: string | null
  client_name?: string | null
  post_contents?: Record<string, string> | null
  created_at?: string | null
  open_date?: string | null
  closing_date?: string | null
  updated_at?: string | null
}

type Job360Data = {
  job?: Job360Job
  post_contents?: Record<string, string>
  required_skills?: string[]
  pipeline?: Record<string, number>
  ranking?: RankedCandidate[]
  submissions?: unknown[]
  interviews?: unknown[]
  offers?: unknown[]
  similar_jobs?: unknown[]
  market?: { insights?: Record<string, unknown>; salary_benchmark?: Record<string, unknown>; reasons?: string[] }
  timeline?: unknown[]
  hiring_difficulty?: string
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-sm font-bold text-slate-400 text-center py-10">No {label.toLowerCase()} yet</p>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      {children}
    </div>
  )
}

function SkillChips({ skills }: { skills: string[] }) {
  if (!skills.length) return <p className="text-sm font-medium text-slate-400">—</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map(s => (
        <span key={s} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
          {s}
        </span>
      ))}
    </div>
  )
}

function EntityList({
  items,
  onOpenCandidate,
  labelKey = 'candidate_name',
}: {
  items?: unknown[]
  onOpenCandidate?: (id: string) => void
  labelKey?: string
}) {
  if (!items?.length) return <EmptyHint label="records" />
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const row = item as Record<string, unknown>
        const id = String(row.id ?? row.resume_id ?? '')
        const title = String(row[labelKey] ?? row.title ?? row.name ?? `Item ${i + 1}`)
        return (
          <li key={id || i} className="py-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-900">{title}</p>
              {row.status != null && <p className="text-xs font-medium text-slate-500">{String(row.status)}</p>}
            </div>
            {id && onOpenCandidate && (
              <button
                type="button"
                onClick={() => onOpenCandidate(id)}
                className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900"
              >
                View →
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function fmtMoney(min?: number | null, max?: number | null, currency?: string | null) {
  if (min == null && max == null) return null
  const cur = currency || 'MYR'
  if (min != null && max != null) return `${cur} ${min.toLocaleString()} – ${max.toLocaleString()}`
  if (min != null) return `${cur} ${min.toLocaleString()}+`
  return `${cur} up to ${Number(max).toLocaleString()}`
}

function employmentLabel(type?: string | null) {
  const t = (type || '').toLowerCase()
  if (t === 'full-time') return 'Permanent / Full-time'
  if (t === 'contract') return 'Contract'
  if (t === 'part-time') return 'Part-time'
  if (t === 'remote') return 'Remote'
  if (t === 'internship') return 'Internship'
  return type || '—'
}

function fmtDateShort(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(v).slice(0, 10)
  }
}

function pickPosts(source?: Record<string, string> | null): Record<string, string> {
  if (!source) return {}
  const out: Record<string, string> = {}
  for (const p of JOB_POST_PLATFORMS) {
    const text = source[p]
    if (typeof text === 'string' && text.trim()) out[p] = text
  }
  return out
}

export function Job360View({
  jobId,
  onClose,
  onOpenCandidate,
  onNavigate,
  variant = 'drawer',
}: {
  jobId: string
  onClose: () => void
  onOpenCandidate?: (id: string) => void
  onNavigate?: (tab: string) => void
  /** @deprecated Posts are generated inside the Posts tab now */
  onGeneratePosts?: (job: Job360Job) => void
  /** Full page vs slide-over drawer */
  variant?: 'drawer' | 'page'
}) {
  const [tab, setTab] = useState<Job360Tab>('overview')
  const [data, setData] = useState<Job360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reparsing, setReparsing] = useState(false)
  const [parseMsg, setParseMsg] = useState<string | null>(null)

  const [posts, setPosts] = useState<Record<string, string>>({})
  const [postTab, setPostTab] = useState<JobPostPlatform>('linkedin')
  const [selectedPlatforms, setSelectedPlatforms] = useState<JobPostPlatform[]>([...JOB_POST_PLATFORMS])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/360`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        setData({ job: { id: jobId, title: 'Job' } })
        setError(body.error || `Could not load job 360 (${res.status})`)
        return
      }
      const json = await res.json() as Job360Data
      setData(json)
      const loaded = pickPosts(json.post_contents || json.job?.post_contents)
      setPosts(loaded)
      const first = (JOB_POST_PLATFORMS.find(p => loaded[p]) || 'linkedin') as JobPostPlatform
      setPostTab(first)
    } catch {
      setData({ job: { id: jobId, title: 'Job' } })
      setError('Network error — limited view')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { load() }, [load])

  const job = data?.job

  const keySkills = [
    ...(Array.isArray(job?.skills_mandatory) ? job!.skills_mandatory! : []),
    ...(Array.isArray(job?.tags) ? job!.tags! : []),
    ...(Array.isArray(data?.required_skills) ? data!.required_skills! : []),
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  const salary = fmtMoney(job?.salary_min, job?.salary_max, job?.currency)
  const hasStructured =
    Boolean(job?.description?.trim()) ||
    Boolean(job?.requirements?.trim()) ||
    keySkills.length > 0
  const rawText = (job?.raw_jd_text || '').trim()
  const hasRaw = Boolean(rawText)

  const reparseFromRaw = async () => {
    if (!rawText) {
      setParseMsg('No raw JD saved on this job. Upload/paste a JD when creating the job.')
      return
    }
    setReparsing(true)
    setParseMsg(null)
    try {
      const parseRes = await fetch('/api/jobs/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, mode: 'ai' }),
      })
      const parsed = await parseRes.json()
      if (!parseRes.ok && !parsed.fields) {
        setParseMsg(parsed.error || 'Parse failed')
        return
      }
      const f = parsed.fields ?? {}
      const patch = {
        title: f.title || job?.title,
        location: f.location || job?.location,
        type: f.type || job?.type,
        department: f.department || job?.department,
        contract_duration: f.contract_duration || job?.contract_duration,
        experience_min: f.experience_min ?? job?.experience_min,
        experience_max: f.experience_max ?? job?.experience_max,
        salary_min: f.salary_min ?? job?.salary_min,
        salary_max: f.salary_max ?? job?.salary_max,
        currency: f.currency || job?.currency,
        description: f.description || job?.description,
        requirements: f.requirements || job?.requirements,
        optional_requirements: f.optional_requirements || job?.optional_requirements,
        skills_mandatory: f.skills_mandatory?.length ? f.skills_mandatory : job?.skills_mandatory,
        skills_required: f.skills_required?.length ? f.skills_required : job?.skills_required,
        tags: f.skills_mandatory?.length ? f.skills_mandatory : job?.tags,
        max_budget: f.max_budget ?? job?.max_budget,
        headcount: f.headcount ?? job?.headcount,
        priority: f.priority || job?.priority,
        raw_jd_text: rawText,
      }
      const saveRes = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) {
        setParseMsg(saveData.error || 'Could not save parsed fields')
        return
      }
      setParseMsg('JD parsed and saved — About Role, Responsibilities, Requirements, Skills updated.')
      await load()
    } catch {
      setParseMsg('Network error while parsing JD')
    } finally {
      setReparsing(false)
    }
  }

  const togglePlatform = (p: JobPostPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? (prev.length === 1 ? prev : prev.filter(x => x !== p)) : [...prev, p]
    )
  }

  const generatePosts = async () => {
    if (!job) return
    if (selectedPlatforms.length === 0) {
      setGenError('Select at least one channel')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/jobs/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_post_id: job.id,
          title: job.title,
          company: job.company || job.client_name,
          location: job.location,
          type: job.type,
          description: job.description || rawText.slice(0, 6000),
          requirements: job.requirements,
          raw_jd_text: job.raw_jd_text || rawText || undefined,
          custom_prompt: customPrompt,
          platforms: selectedPlatforms,
          force: true,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(body.error || `Generate failed (${res.status})`)
        return
      }
      const next = pickPosts(body.posts)
      if (!Object.keys(next).length) {
        setGenError('AI returned empty posts — try again')
        return
      }
      setPosts(prev => ({ ...prev, ...next }))
      const first = (JOB_POST_PLATFORMS.find(p => next[p]) || selectedPlatforms[0]) as JobPostPlatform
      setPostTab(first)
    } catch {
      setGenError('Network error while generating posts')
    } finally {
      setGenerating(false)
    }
  }

  const copyPost = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const openPostsTab = () => setTab('posts')

  const actionCards = [
    { key: 'posts', label: 'Generate Job Post', desc: 'LinkedIn, Indeed, Long/Medium/Short', color: 'bg-blue-600 hover:bg-blue-500', tab: 'posts' as Job360Tab, tool: null as string | null },
    { key: 'boolean', label: 'Boolean Search', desc: 'Strings from this JD', color: 'bg-emerald-600 hover:bg-emerald-500', tab: null, tool: 'boolean' },
    { key: 'screen', label: 'AI Screening', desc: 'Screen CVs with this JD', color: 'bg-violet-600 hover:bg-violet-500', tab: null, tool: 'screen' },
    { key: 'internal', label: 'Internal Match', desc: 'Best talent pool fits', color: 'bg-teal-600 hover:bg-teal-500', tab: 'internal_matches' as Job360Tab, tool: null },
    { key: 'pipeline', label: 'Candidate Pipeline', desc: 'Lifecycle by stage', color: 'bg-orange-600 hover:bg-orange-500', tab: 'pipeline' as Job360Tab, tool: null },
    { key: 'ranking', label: 'Analytics / Ranking', desc: 'Fit scores & ranks', color: 'bg-amber-600 hover:bg-amber-500', tab: 'ranking' as Job360Tab, tool: null },
    { key: 'interviews', label: 'Interview Status', desc: 'Rounds for this job', color: 'bg-rose-600 hover:bg-rose-500', tab: 'interviews' as Job360Tab, tool: null },
  ]

  const shellClass = variant === 'page'
    ? ''
    : 'drawer-overlay'
  const panelClass = variant === 'page'
    ? 'max-w-6xl mx-auto px-4 py-6'
    : 'drawer-panel'
  const panelStyle = variant === 'page' ? undefined : { maxWidth: 860 }

  return (
    <div
      className={shellClass}
      style={variant === 'drawer' ? { zIndex: 60 } : undefined}
      onClick={variant === 'drawer' ? (e => { if (e.target === e.currentTarget) onClose() }) : undefined}
    >
      <div className={panelClass} style={panelStyle}>
        <div className={variant === 'page' ? 'rounded-2xl bg-white border border-slate-200 shadow-sm mb-4' : ''}>
        <div className={variant === 'page' ? 'px-5 py-4 border-b border-slate-200' : 'drawer-header'}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              {variant === 'page' && (
                <button type="button" onClick={onClose} className="text-xs font-bold text-indigo-700 hover:underline mb-1">
                  ← Back to Jobs
                </button>
              )}
              <h2 className="text-lg font-extrabold text-slate-900 truncate page-title">{job?.title ?? 'Job 360°'}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {job?.priority && <span className="ui-badge ui-badge--orange">{job.priority}</span>}
                {job?.status && <span className="ui-badge ui-badge--blue">{job.status}</span>}
                {(job?.company || job?.client_name) && <span className="ui-badge ui-badge--purple">{job.company || job.client_name}</span>}
                {job?.location && <span className="ui-badge ui-badge--cyan">{job.location}</span>}
                {job?.type && <span className="ui-badge ui-badge--slate">{employmentLabel(job.type)}</span>}
                {job?.contract_duration && <span className="ui-badge ui-badge--amber">{job.contract_duration}</span>}
                {salary && <span className="ui-badge ui-badge--green">{salary}</span>}
                {job?.short_id && <span className="ui-badge ui-badge--slate font-mono">{job.short_id}</span>}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1.5">
                {[job?.open_date || job?.created_at ? `Open ${fmtDateShort(job.open_date || job.created_at)}` : null,
                  job?.closing_date ? `Close ${fmtDateShort(job.closing_date)}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openPostsTab}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate Posts
            </button>
            {variant === 'drawer' && (
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {variant === 'page' && (
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 border-b border-slate-100">
            {actionCards.map(card => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  if (card.tab) setTab(card.tab)
                  else if (card.tool && onNavigate) onNavigate(card.tool)
                }}
                className={`text-left rounded-xl ${card.color} text-white px-3 py-3 shadow-sm transition-colors`}
              >
                <p className="text-xs font-extrabold leading-tight">{card.label}</p>
                <p className="text-[10px] font-medium opacity-90 mt-1 leading-snug">{card.desc}</p>
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-slate-200 bg-white px-2 py-2 sticky top-0 z-10 space-y-2">
          {TAB_GROUPS.map(group => (
            <div key={group.label} className="flex flex-wrap items-center gap-1">
              <span className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 ${group.accent} opacity-80 min-w-[4.5rem]`}>
                {group.label}
              </span>
              {group.tabs.map(t => {
                const Icon = TAB_ICONS[t]
                const count =
                  t === 'posts' ? Object.keys(posts).length
                  : t === 'pipeline' ? Object.values(data?.pipeline ?? {}).reduce((a, b) => a + b, 0)
                  : t === 'submissions' ? (data?.submissions?.length ?? 0)
                  : t === 'interviews' ? (data?.interviews?.length ?? 0)
                  : t === 'offers' ? (data?.offers?.length ?? 0)
                  : t === 'ranking' ? (data?.ranking?.length ?? 0)
                  : 0
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap ${
                      tab === t
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {Icon ? <Icon className="w-3 h-3 opacity-80" /> : null}
                    {TAB_LABELS[t]}
                    {count > 0 ? (
                      <span className={`ui-badge !px-1.5 !py-0 ${tab === t ? 'bg-white/20 text-white border-white/30' : 'ui-badge--slate'}`}>
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        </div>

        <div className={variant === 'page' ? 'rounded-2xl bg-white border border-slate-200 shadow-sm p-5' : 'drawer-body'}>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              {error && (
                <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{error}</p>
              )}
              {parseMsg && (
                <p className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">{parseMsg}</p>
              )}

              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {[
                      { label: 'AI Match', value: data?.ranking?.[0]?.ai_score != null ? `${data.ranking[0].ai_score}` : '—', tone: 'g2' },
                      { label: 'Candidates', value: Object.values(data?.pipeline ?? {}).reduce((a, b) => a + b, 0), tone: 'g1' },
                      { label: 'Interviews', value: data?.interviews?.length ?? 0, tone: 'g4' },
                      { label: 'Submissions', value: data?.submissions?.length ?? 0, tone: 'g3' },
                      { label: 'Offers', value: data?.offers?.length ?? 0, tone: 'g5' },
                    ].map(m => (
                      <div key={m.label} className={`kpi-card kpi-card--gradient kpi-card--${m.tone} !min-h-[88px]`}>
                        <p className="kpi-card__label">{m.label}</p>
                        <p className="kpi-card__value text-xl">{m.value}</p>
                      </div>
                    ))}
                  </div>
                  {!hasStructured && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-sm font-extrabold text-amber-950">JD fields are empty</p>
                      <p className="text-xs font-medium text-amber-900">
                        {hasRaw
                          ? 'Raw JD is available — open JD Document tab or parse below.'
                          : 'No raw JD on file. Create the job again with Upload/Paste + Parse with AI.'}
                      </p>
                      {hasRaw && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={reparsing}
                            onClick={reparseFromRaw}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-extrabold disabled:opacity-50"
                          >
                            {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Parse JD now & save fields
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab('jd_document')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-extrabold"
                          >
                            <FileText className="w-3.5 h-3.5" /> View raw JD
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      ['Location', job?.location || '—'],
                      ['Employment', employmentLabel(job?.type)],
                      ['Experience', (job?.experience_min != null || job?.experience_max != null)
                        ? `${job?.experience_min ?? 0}–${job?.experience_max ?? '—'} yrs`
                        : '—'],
                      ['Salary', salary || '—'],
                      ['Budget', job?.max_budget != null ? `${job.currency || 'MYR'} ${Number(job.max_budget).toLocaleString()}` : '—'],
                      ['Headcount', job?.headcount != null ? String(job.headcount) : '—'],
                      ['Department', job?.department || '—'],
                      ['Contract duration', job?.contract_duration || '—'],
                      ['Priority', job?.priority || '—'],
                      ['Hiring manager', job?.hiring_manager || '—'],
                      ['Difficulty', job?.hiring_difficulty || data?.hiring_difficulty || '—'],
                      ['Client', job?.client_name || job?.company || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
                        <p className="text-sm font-extrabold text-slate-900 mt-1 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>

                  <Section title="About the Role & Responsibilities">
                    {job?.description?.trim() ? (
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.description}</pre>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">Not filled yet — parse the JD to populate this.</p>
                    )}
                  </Section>

                  <Section title="Requirements">
                    {job?.requirements?.trim() ? (
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.requirements}</pre>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">Not filled yet.</p>
                    )}
                  </Section>

                  {job?.optional_requirements?.trim() ? (
                    <Section title="Nice-to-have">
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.optional_requirements}</pre>
                    </Section>
                  ) : null}

                  <Section title="Key Skills">
                    <SkillChips skills={keySkills} />
                  </Section>

                  <OwnershipPanel entityType="job" entityId={jobId} compact />

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Raw JD document {hasRaw ? `(${rawText.length.toLocaleString()} chars)` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('jd_document')}
                        className="text-xs font-extrabold text-indigo-700 hover:underline"
                      >
                        Open full document →
                      </button>
                    </div>
                    {hasRaw ? (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                        {rawText.slice(0, 2500)}
                        {rawText.length > 2500 ? '\n\n… open JD Document tab for full text' : ''}
                      </pre>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">No raw JD stored for this job.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={reparsing || !hasRaw}
                      onClick={reparseFromRaw}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Re-parse from raw JD
                    </button>
                    <button
                      type="button"
                      onClick={openPostsTab}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Go to Posts tab
                    </button>
                  </div>
                </div>
              )}

              {tab === 'jd_document' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Full raw JD document</p>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">
                        Original pasted/uploaded job description stored with this job
                        {hasRaw ? ` · ${rawText.length.toLocaleString()} characters` : ''}.
                      </p>
                    </div>
                  </div>
                  {hasRaw ? (
                    <>
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-800 leading-relaxed bg-white border border-slate-200 rounded-xl p-4 max-h-[60vh] overflow-auto">
                        {rawText}
                      </pre>
                      <button
                        type="button"
                        disabled={reparsing}
                        onClick={reparseFromRaw}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold disabled:opacity-50"
                      >
                        {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Parse this JD into Overview fields
                      </button>
                    </>
                  ) : (
                    <EmptyHint label="raw JD document" />
                  )}
                </div>
              )}

              {tab === 'posts' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                    <p className="text-sm font-extrabold text-indigo-950">Channel posts</p>
                    <p className="text-xs font-medium text-indigo-900/80">
                      Generate Email, LinkedIn, WhatsApp, Indeed and more from this JD. Posts are saved on the job.
                    </p>
                    <input
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="Optional extra instructions (e.g. highlight remote, target seniors…)"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-100 bg-white text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {JOB_POST_PLATFORMS.map(p => {
                        const on = selectedPlatforms.includes(p)
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePlatform(p)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                              on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                            title={JOB_POST_PLATFORM_META[p].hint}
                          >
                            {JOB_POST_PLATFORM_META[p].label}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={generating || selectedPlatforms.length === 0}
                      onClick={generatePosts}
                      className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold disabled:opacity-50"
                    >
                      {generating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                        : Object.keys(posts).length
                          ? <><Sparkles className="w-4 h-4" /> Regenerate selected posts</>
                          : <><Sparkles className="w-4 h-4" /> Generate posts from JD</>}
                    </button>
                    {genError && (
                      <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{genError}</p>
                    )}
                  </div>

                  {Object.keys(posts).length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {JOB_POST_PLATFORMS.map(p => (
                          posts[p] ? (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPostTab(p)}
                              className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                postTab === p ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {JOB_POST_PLATFORM_META[p].label}
                            </button>
                          ) : null
                        ))}
                      </div>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={posts[postTab] ?? ''}
                          rows={14}
                          className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 leading-relaxed resize-y min-h-[220px]"
                        />
                        <button
                          type="button"
                          onClick={() => copyPost(postTab, posts[postTab] ?? '')}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200"
                        >
                          {copiedKey === postTab
                            ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</>
                            : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-extrabold text-amber-950">No posts yet</p>
                      <p className="text-xs font-medium text-amber-900 mt-1">
                        Click <span className="font-extrabold">Generate posts from JD</span> above. Results appear here and are saved on this job.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'pipeline' && (
                <div>
                  {data?.pipeline && Object.keys(data.pipeline).length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(data.pipeline).map(([stage, count]) => (
                        <div key={stage} className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-xl font-extrabold text-indigo-700">{count}</p>
                          <p className="text-[10px] font-extrabold text-slate-500 capitalize mt-1">{stage.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint label="pipeline stages" />
                  )}
                </div>
              )}

              {tab === 'ranking' && (
                <div className="space-y-3">
                  {!data?.ranking?.length ? (
                    <EmptyHint label="ranked candidates" />
                  ) : (
                    data.ranking.map((c, i) => (
                      <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-400">#{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => onOpenCandidate?.(c.id)}
                              className="text-sm font-extrabold text-indigo-700 hover:underline"
                            >
                              {c.candidate_name ?? c.id.slice(0, 8)}
                            </button>
                          </div>
                          {c.ai_score != null && (
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {c.ai_score}%
                            </span>
                          )}
                        </div>
                        {c.ai_fit_scores?.overall != null && (
                          <AiFitScoreCard scores={c.ai_fit_scores as AiFitScores} compact />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'submissions' && <EntityList items={data?.submissions} onOpenCandidate={onOpenCandidate} />}
              {tab === 'interviews' && <EntityList items={data?.interviews} onOpenCandidate={onOpenCandidate} />}
              {tab === 'offers' && <EntityList items={data?.offers} onOpenCandidate={onOpenCandidate} />}
              {tab === 'internal_matches' && (
                <InternalMatchesTab jobId={jobId} onOpenCandidate={onOpenCandidate} />
              )}
              {tab === 'notes' && (
                <EntityNotesTimeline
                  entityType="job"
                  entityId={jobId}
                  title="Job notes"
                  subtitle="Team notes for this requisition — pinned, private, and searchable."
                />
              )}
              {tab === 'similar_jobs' && <EntityList items={data?.similar_jobs} labelKey="title" />}
              {tab === 'market' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Market intelligence
                  </div>
                  {Array.isArray(data?.market?.reasons) && data!.market!.reasons!.length > 0 && (
                    <ul className="space-y-1.5">
                      {data!.market!.reasons!.map((r, i) => (
                        <li key={i} className="text-sm font-medium text-slate-700">• {r}</li>
                      ))}
                    </ul>
                  )}
                  {data?.market?.salary_benchmark && Object.keys(data.market.salary_benchmark).length > 0 ? (
                    <pre className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(data.market.salary_benchmark, null, 2)}
                    </pre>
                  ) : null}
                  {!data?.market?.reasons?.length && !data?.market?.salary_benchmark && (
                    <EmptyHint label="market data" />
                  )}
                </div>
              )}
              {tab === 'timeline' && <EntityList items={data?.timeline} labelKey="title" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
