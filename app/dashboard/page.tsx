'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { EditCandidateModal } from '@/components/candidates/EditCandidateModal'
import { SubmissionDetailsModal } from '@/components/candidates/SubmissionDetailsModal'
import { CandidateAllocatePanel } from '@/components/candidates/CandidateAllocatePanel'
import { Candidate360TabBar, Candidate360Panels, isCandidate360PanelTab } from '@/components/candidates/Candidate360View'
import { CandidateColumnPicker } from '@/components/candidates/CandidateColumnPicker'
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { applyAppearance } from '@/lib/appearance'
import { loadCandidateColumnPrefs, type CandidateColumnKey, CANDIDATE_COLUMNS } from '@/lib/candidateColumnPrefs'
import { formatPhoneInternational } from '@/lib/phoneFormat'
import { cleanCandidateName } from '@/lib/nameClean'
import { CandidateBulkBar } from '@/components/recruitment/CandidateBulkBar'
import { SubmissionsTab } from '@/components/recruitment/SubmissionsTab'
import { InterviewsTab } from '@/components/recruitment/InterviewsTab'
import { FollowUpsTab } from '@/components/recruitment/FollowUpsTab'
import { InternalTalentPoolTab } from '@/components/recruitment/InternalTalentPoolTab'
import { WorkspaceTab } from '@/components/recruitment/WorkspaceTab'
import { AiRecruiterWorkspace } from '@/components/recruitment/AiRecruiterWorkspace'
import { Job360View } from '@/components/recruitment/Job360View'
import { AiFitScoreCard } from '@/components/recruitment/AiFitScoreCard'
import { ScreeningReportView, ScreeningReportErrorBoundary } from '@/components/recruitment/ScreeningReportView'
import type { ScreenResult } from '@/lib/screeningTypes'
import { parseUploadedFile } from '@/lib/parseFileClient'
import type { AiFitScores } from '@/lib/aiFitScore'
import { SelectedPipelineTab } from '@/components/recruitment/SelectedPipelineTab'
import { ESSTab } from '@/components/ess/ESSTab'
import { MyPerformanceTab } from '@/components/analytics/MyPerformanceTab'
import { ClientsTab } from '@/components/recruitment/ClientsTab'
import { RecruitersTab } from '@/components/recruitment/RecruitersTab'
import { DocumentsRegistryTab } from '@/components/recruitment/DocumentsRegistryTab'
import { ReportsTab } from '@/components/recruitment/ReportsTab'
import { HrConfigTab } from '@/components/recruitment/HrConfigTab'
import { CommsHubTab } from '@/components/recruitment/CommsHubTab'
import { NewJobModal } from '@/components/recruitment/NewJobModal'
import { AddCandidateFlow } from '@/components/recruitment/AddCandidateFlow'
import { DeleteActionButton } from '@/components/recruitment/DeleteActionButton'
import { DeleteApprovalsPanel } from '@/components/recruitment/DeleteApprovalsPanel'
import { RagReindexPanel } from '@/components/settings/RagReindexPanel'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { GlobalSearchPalette } from '@/components/dashboard/GlobalSearchPalette'
import { InstallAppButton } from '@/components/pwa/PwaInstall'
import { GovernanceTab } from '@/components/governance/GovernanceTab'
import { SecurityCenterTab } from '@/components/security/SecurityCenterTab'
import { EmailCalendarHub } from '@/components/security/EmailCalendarHub'
import { BrandMark, AppSplash } from '@/components/ui/BrandMark'
import {
  getCandidateDossierChecks as buildDossierChecks,
  getCandidateDossierStatus as buildDossierStatus,
  dossierDisplayValue as buildDossierDisplayValue,
  type DossierCheck,
} from '@/lib/dossierChecks'
import { formatLifecycle, HIRE_TYPES, HIRE_TYPE_LABELS, LIFECYCLE_STATUSES, LIFECYCLE_LABELS, VISA_TYPES, VISA_TYPE_LABELS } from '@/lib/candidateLifecycle'
import { PLAN_LIMITS } from '@/lib/planLimits'
import {
  JOB_POST_PLATFORMS,
  JOB_POST_PLATFORM_META,
  type JobPostPlatform,
} from '@/lib/jobPostPlatforms'
import {
  Briefcase, Users, Search, Plus, ChevronDown, LogOut,
  Zap, Star, TrendingUp, X, Crown, Filter,
  ArrowRight, BarChart3, Target, Inbox, Clock, CheckCircle,
  Upload, FileText, Sparkles, Copy, Check, Mail,
  RefreshCw, AlertCircle, Layers, Brain, ChevronRight,
  MoreVertical, Send, Loader2, Download, Settings, User as UserIcon, CreditCard, Activity, Shield,
  Key, Pencil, Eye, EyeOff, Link2, Trash2, ToggleLeft, ToggleRight, ExternalLink, Info,
  Bell, Award, Calendar, Building2, MessageSquare, PenLine, HelpCircle, BookOpen, UserCheck, ChevronUp,
  Smartphone
} from 'lucide-react'

type DashboardTab =
  | 'workspace' | 'pipeline' | 'candidates' | 'submissions' | 'interviews' | 'followups' | 'selected'
  | 'performance' | 'coach' | 'clients' | 'recruiters' | 'documents' | 'reports' | 'governance'
  | 'talent'
  | 'screen' | 'compose' | 'jobs' | 'analytics' | 'settings' | 'jd' | 'boolean' | 'import' | 'integrations' | 'comms' | 'ess'
  | 'hrconfig'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Job {
  id: string; short_id: string; title: string; company: string
  location: string; type: string; status: string; applications_count: number
  description?: string; requirements?: string; optional_requirements?: string | null
  salary_min?: number | null; salary_max?: number | null; currency?: string
  tags?: string[]
  created_at: string
  updated_at?: string
  // saved social posts attached by /api/jobs GET
  post_contents?: Record<string, string> | null
}

/** SaaS policy: workspace (tenant) membership tenure before ownership / primary-assignee review — months */
const WORKSPACE_MEMBER_TENURE_REVIEW_MONTHS = 3

function monthsSince(iso: string | undefined | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.4375)
}

function formatUploader(by: { name: string | null; email: string | null } | null | undefined): string {
  if (!by) return 'Unknown user'
  if (by.name?.trim()) return by.name.trim()
  if (by.email?.trim()) return by.email.trim()
  return 'Unknown user'
}

interface Candidate {
  id: string; short_id: string; candidate_name: string; candidate_email: string
  candidate_phone: string | null
  ai_score: number | null
  match_category: 'best' | 'good' | 'partial' | 'poor' | null
  pipeline_stage: string; status: string; ai_skills: string[]; ai_summary: string
  ai_screening_data?: ScreenResult | null
  candidate_profile?: Record<string, string | null> | null
  raw_text: string | null; file_name: string | null
  /** Server path segment under uploads/candidate-resumes/ when an original file was stored */
  resume_original_path?: string | null
  reviewer_notes?: string | null
  source_type?: string | null
  /** Who created this resume row in this tenant (never cross-tenant). */
  uploaded_by?: { name: string | null; email: string | null } | null
  /** Workspace member who owns this profile (tenant-scoped). */
  user_id?: string | null
  job_posts: { id: string; short_id: string; title: string; company: string } | null
  created_at: string
  updated_at?: string
  last_contacted_at?: string | null
}

interface CandDupExisting {
  id: string
  short_id: string
  name: string
  pipeline_stage?: string
  status?: string
  created_at?: string
  uploaded_by?: { name: string | null; email: string | null } | null
}

interface StageCounts { [stage: string]: number }

// ScreenResult imported from @/lib/screeningTypes (v2.0 additive schema)

// ── Constants ──────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'sourced',       label: 'Sourced',        color: 'bg-slate-700',      text: 'text-slate-300',   bar: 'bg-slate-400',      icon: Inbox },
  { key: 'applied',       label: 'Applied',        color: 'bg-[#14532d]',      text: 'text-emerald-200', bar: 'bg-[#166534]',     icon: Briefcase },
  { key: 'screening',     label: 'Screening',      color: 'bg-[#9a3412]',      text: 'text-orange-200',  bar: 'bg-[#F97316]',     icon: Target },
  { key: 'submitted',     label: 'Submitted',      color: 'bg-[#0B1F14]',      text: 'text-emerald-100', bar: 'bg-[#14532d]',     icon: Briefcase },
  { key: 'interview',     label: 'Interview',      color: 'bg-amber-900/60',   text: 'text-amber-300',   bar: 'bg-amber-500',      icon: Clock },
  { key: 'offer',         label: 'Offer',          color: 'bg-emerald-900/60', text: 'text-emerald-300', bar: 'bg-[#22C55E]',     icon: CheckCircle },
  { key: 'hr_onboarding', label: 'HR / Onboarding', color: 'bg-[#14532d]',     text: 'text-emerald-200', bar: 'bg-[#166534]',     icon: CheckCircle },
  { key: 'joined',        label: 'Joined',         color: 'bg-[#0B1F14]',      text: 'text-emerald-200', bar: 'bg-[#22C55E]',     icon: Star },
  { key: 'employee',      label: 'Employee',       color: 'bg-[#0B1F14]',      text: 'text-emerald-200', bar: 'bg-[#166534]',     icon: Star },
  { key: 'on_hold',       label: 'On Hold',        color: 'bg-[#9a3412]/80',   text: 'text-orange-200',  bar: 'bg-[#F97316]',     icon: Clock },
  { key: 'rejected',      label: 'Rejected',       color: 'bg-red-900/60',     text: 'text-red-300',     bar: 'bg-red-500',        icon: X },
  { key: 'withdrawn',     label: 'Withdrawn',      color: 'bg-rose-900/60',    text: 'text-rose-300',    bar: 'bg-rose-500',       icon: X },
]

// Light variants for white-bg contexts (candidates table, job rows etc.)
const STAGE_LIGHT: Record<string, { bg: string; text: string; border: string }> = {
  sourced:       { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200' },
  applied:       { bg: 'bg-[#ecfdf3]',  text: 'text-[#166534]',   border: 'border-[#166534]/20' },
  screening:     { bg: 'bg-[#fff7ed]',  text: 'text-[#c2410c]',   border: 'border-[#F97316]/30' },
  submitted:     { bg: 'bg-[#ecfdf3]',  text: 'text-[#14532d]',   border: 'border-[#166534]/25' },
  interview:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  offer:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  hr_onboarding: { bg: 'bg-[#ecfdf3]',  text: 'text-[#166534]',   border: 'border-[#166534]/20' },
  joined:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  hired:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  employee:      { bg: 'bg-[#ecfdf3]',  text: 'text-[#166534]',   border: 'border-[#166534]/20' },
  on_hold:       { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  rejected:      { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  withdrawn:     { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
}

const MATCH_CONFIG = {
  best:    { label: 'Best Match',    bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  good:    { label: 'Good Match',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    bar: 'bg-blue-500' },
  partial: { label: 'Partial Match', bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-500' },
  poor:    { label: 'Low Match',     bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-500' },
}

// Light variants for white-bg contexts
const MATCH_LIGHT = {
  best:    { label: 'Best Match',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  good:    { label: 'Good Match',    bg: 'bg-[#ecfdf3]',    text: 'text-[#166534]',    border: 'border-[#166534]/25' },
  partial: { label: 'Partial Match', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  poor:    { label: 'Low Match',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MatchBadge({ category, score, variant = 'dark' }: { category: string | null; score: number | null; variant?: 'dark' | 'light' }) {
  const cfg = variant === 'light' ? MATCH_LIGHT : MATCH_CONFIG
  const fromScore = (): keyof typeof MATCH_CONFIG | null => {
    if (score == null || Number.isNaN(Number(score))) return null
    const s = Number(score)
    if (s >= 75) return 'best'
    if (s >= 60) return 'good'
    if (s >= 45) return 'partial'
    return 'poor'
  }
  const cat = (category != null && category in cfg ? category : null) as keyof typeof MATCH_CONFIG | null ?? fromScore()
  if (!cat && score == null) return <span className="text-xs text-gray-500">—</span>
  if (!cat && score != null) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${variant === 'light' ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white/10 text-gray-300 border-white/15'}`}>
        {Math.round(Number(score))}%
      </span>
    )
  }
  const c = cfg[cat as keyof typeof cfg] ?? cfg.poor
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {score != null && <span>{Math.round(Number(score))}%</span>}
      {' '}{c.label}
    </span>
  )
}

function StagePill({ stage, variant = 'dark' }: { stage: string; variant?: 'dark' | 'light' }) {
  if (variant === 'light') {
    const s = STAGE_LIGHT[stage] ?? STAGE_LIGHT.sourced
    const label = PIPELINE_STAGES.find(p => p.key === stage)?.label ?? stage
    return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{label}</span>
  }
  const s = PIPELINE_STAGES.find(p => p.key === stage) ?? PIPELINE_STAGES[0]
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.color} ${s.text}`}>{s.label}</span>
}

function ShortIdBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const doCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id).catch(() => {
      const ta = document.createElement('textarea'); ta.value = id
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    })
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={doCopy} title="Click to copy ID"
      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 hover:bg-indigo-200 transition-colors">
      {id}
      {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
    </button>
  )
}

// ── Date formatting utility ────────────────────────────────────────────────
function fmtDate(d: string | null | undefined, includeTime = false): string {
  if (!d) return '—'
  try {
    const date = new Date(d)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const day = date.getDate()
    const mon = months[date.getMonth()]
    const year = date.getFullYear()
    if (!includeTime) return `${day} ${mon} ${year}`
    const h = date.getHours(), m = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = ((h % 12) || 12).toString().padStart(2,'0')
    const mm = m.toString().padStart(2,'0')
    return `${day} ${mon} ${year}, ${h12}:${mm} ${ampm}`
  } catch { return '—' }
}

/** One-line summary for candidate list (recruiter-maintained ATS record). */
function candidateRecordSummary(profile: Record<string, string | null> | null | undefined): string {
  if (!profile || typeof profile !== 'object') return ''
  const parts = [profile.current_location, profile.notice_period, profile.salary_expectation].filter(Boolean) as string[]
  return parts.join(' · ')
}

/** Trims string-ish values for dossier checks. */
function dossierStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  return String(v).trim()
}

function getCandidateDossierChecks(c: Candidate): DossierCheck[] {
  return buildDossierChecks(c)
}

function getCandidateDossierStatus(c: Candidate) {
  return buildDossierStatus(c)
}

function dossierDisplayValue(c: Candidate, id: string): string {
  return buildDossierDisplayValue(c, id)
}

function CandidateDossierListCell({ c }: { c: Candidate }) {
  const { dossierPercent, requiredMissing, recommendedMissing } = getCandidateDossierStatus(c)
  const tip = [
    requiredMissing.length ? `Required: ${requiredMissing.join(', ')}` : '',
    recommendedMissing.length ? `Recommended: ${recommendedMissing.join(', ')}` : '',
  ].filter(Boolean).join('\n')
  const tone = requiredMissing.length ? 'text-red-600' : recommendedMissing.length ? 'text-amber-600' : 'text-emerald-600'
  const border = requiredMissing.length ? 'border-red-200 bg-red-50/80' : recommendedMissing.length ? 'border-amber-200 bg-amber-50/80' : 'border-emerald-200 bg-emerald-50/60'
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${border}`} title={tip || 'Dossier complete'}>
      <span className={`text-xs font-bold tabular-nums ${tone}`}>{dossierPercent}%</span>
      {(requiredMissing.length > 0 || recommendedMissing.length > 0) && (
        <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 ${requiredMissing.length ? 'text-red-500' : 'text-amber-500'}`} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// JD Intelligence Tab
// ─────────────────────────────────────────────────────────────────────────────
function JDTab() {
  const [jobTitle, setJobTitle] = useState('')
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('Full-Time')
  const [salary, setSalary] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [analyzeText, setAnalyzeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [mode, setMode] = useState<'generate' | 'analyze'>('generate')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<{id: string; title: string; created_at: string}[]>([])

  const EMPLOYMENT_OPTIONS = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote', 'Hybrid'] as const

  useEffect(() => {
    fetch('/api/jd').then(r => r.json()).then(d => setHistory(d.jds ?? []))
  }, [result])

  async function submit(force = false) {
    setError(''); setLoading(true)
    if (!force) setResult(null)
    try {
      const payload = mode === 'generate'
        ? { action: 'generate', job_title: jobTitle, skills: skills.split(',').map(s => s.trim()).filter(Boolean),
            experience, location, employment_type: employmentType, salary, company_name: companyName, force }
        : { action: 'analyze', jd_text: analyzeText, force }
      const res = await fetch('/api/jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    setLoading(false)
  }

  const jdText = result?.full_jd_text as string | undefined

  return (
    <div className="max-w-4xl space-y-6">
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>JD Writer</h1>
            <p className="text-sm text-slate-500 mt-0.5">Generate a professional job description — channel posts live under Generate Job Post</p>
          </div>
        </div>
      </div>

      <div className="option-card-grid mb-2">
        <button
          type="button"
          onClick={() => { setMode('generate'); setResult(null) }}
          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${mode === 'generate' ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-md ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-150'}`}
        >
          <p className="text-sm font-extrabold text-slate-900">Generate JD</p>
          <p className="text-xs text-slate-500 mt-1">Build a structured professional job description from title, skills, and context.</p>
        </button>
        <button
          type="button"
          onClick={() => { setMode('analyze'); setResult(null) }}
          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${mode === 'analyze' ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-md ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-150'}`}
        >
          <p className="text-sm font-extrabold text-slate-900">Analyze JD</p>
          <p className="text-xs text-slate-500 mt-1">Extract skills, interview questions, and alternate titles from an existing JD.</p>
        </button>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-slate-900">Channel posts</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Use <span className="font-black text-indigo-700">Generate Job Post</span> for LinkedIn, WhatsApp, Email, and Indeed.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
            {mode === 'generate' ? (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-800 mb-4">Generate Job Description</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Job Title *</label>
                    <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior React Developer"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Company Name</label>
                    <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Required Skills</label>
                    <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, TypeScript, Node.js, PostgreSQL"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Experience</label>
                    <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="3–5 years"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Hyderabad / Remote"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-2 block">Employment Type</label>
                    <div className="option-card-grid">
                      {EMPLOYMENT_OPTIONS.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEmploymentType(t)}
                          className={`rounded-xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 ${employmentType === t ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                        >
                          <span className="text-xs font-extrabold text-slate-800">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Salary / CTC (optional)</label>
                    <input value={salary} onChange={e => setSalary(e.target.value)} placeholder="₹12–18 LPA or $80k–100k"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-3">Analyze Existing JD</h2>
                <p className="text-xs text-gray-500 mb-3">Paste a JD to extract skills, suggest interview questions, identify skill clusters, and generate boolean search strings.</p>
                <textarea value={analyzeText} onChange={e => setAnalyzeText(e.target.value)}
                  rows={8} placeholder="Paste the full job description here…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-gray-400 mt-2 mb-1">Or upload a JD file (PDF / DOCX / TXT):</p>
                <LightFileUploadZone
                  label="Upload JD (PDF/DOC/DOCX/TXT) — click or drag & drop"
                  accept=".pdf,.docx,.doc,.txt"
                  onText={t => setAnalyzeText(prev => prev ? prev + '\n' + t : t)}
                  disabled={loading}
                />
              </div>
            )}

            {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

            <button onClick={() => submit(false)} disabled={loading || (mode === 'generate' ? !jobTitle.trim() : !analyzeText.trim())}
              className="mt-4 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-orange-900/15">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                : <><Sparkles className="w-4 h-4" />{mode === 'generate' ? 'Generate Job Description' : 'Analyze JD'}</>}
            </button>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              {Boolean(result.cached || result.generation) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-600">
                    {result.cached ? 'Last Generated (cached — no tokens used)' : 'Freshly generated'}
                    {typeof (result.generation as { generated_at?: string } | undefined)?.generated_at === 'string'
                      ? ` · ${new Date((result.generation as { generated_at: string }).generated_at).toLocaleString()}`
                      : ''}
                    {(result.generation as { model?: string } | undefined)?.model
                      ? ` · ${(result.generation as { model: string }).model}`
                      : ''}
                    {(result.generation as { tokens?: number } | undefined)?.tokens
                      ? ` · ${(result.generation as { tokens: number }).tokens} tokens`
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-[11px] font-extrabold disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Again
                  </button>
                </div>
              )}
              {mode === 'generate' && jdText ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Generated JD</h3>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(jdText); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">
                        {copied ? <><Check className="w-3 h-3 text-green-500" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                      <button onClick={() => {
                        const blob = new Blob([jdText], { type: 'text/plain' })
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                        a.download = `${(result.job_title as string) ?? 'JD'}.txt`; a.click()
                      }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">
                        <Download className="w-3 h-3" />Download
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed max-h-[40vh] overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-200">{jdText.replace(/[□☐■▪◦◆►▸]/g, '•')}</pre>
                  <p className="mt-3 text-xs text-slate-500">
                    Need social channel posts? Open <span className="font-semibold text-indigo-700">Generate Job Post</span> from Jobs or AI Hub.
                  </p>
                </div>
              ) : mode === 'analyze' ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Analysis Results</h3>
                  {(result.must_have_skills as string[] | undefined)?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Must-Have Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(result.must_have_skills as string[]).map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs">{s}</span>)}
                      </div>
                    </div>
                  ) : null}
                  {(result.nice_to_have_skills as string[] | undefined)?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nice-to-Have Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(result.nice_to_have_skills as string[]).map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs">{s}</span>)}
                      </div>
                    </div>
                  ) : null}
                  {(result.suggested_questions as string[] | undefined)?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggested Interview Questions</p>
                      <ol className="space-y-1">
                        {(result.suggested_questions as string[]).map((q, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="flex-shrink-0 font-semibold text-gray-400">{i+1}.</span>{q}</li>)}
                      </ol>
                    </div>
                  ) : null}
                  {(result.alternate_titles as string[] | undefined)?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alternate Titles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(result.alternate_titles as string[]).map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs">{t}</span>)}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* History sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-fit">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent JDs</h3>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No JDs generated yet</p>
          ) : (
            <div className="space-y-2">
              {history.map(j => (
                <div key={j.id} className="p-2 rounded-lg border border-gray-100 hover:border-gray-300 cursor-pointer transition-all">
                  <p className="text-xs font-medium text-gray-800 truncate">{j.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(j.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Boolean Search Tab
// ─────────────────────────────────────────────────────────────────────────────
function BooleanTab({ initialJobId = null }: { initialJobId?: string | null }) {
  const [jobTitle, setJobTitle] = useState('')
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [jdText, setJdText] = useState('')
  const [mode, setMode] = useState<'simple' | 'fromjd'>(initialJobId ? 'fromjd' : 'simple')
  const [loading, setLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(Boolean(initialJobId))
  const [jobMeta, setJobMeta] = useState<{ title?: string; client?: string | null } | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [history, setHistory] = useState<{id: string; job_title: string; short_boolean: string; created_at: string}[]>([])
  const autoRanFor = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/boolean-search').then(r => r.json()).then(d => setHistory(d.searches ?? [])).catch(() => undefined)
  }, [result])

  async function submit(force = false, jdOverride?: string) {
    const jd = (jdOverride ?? jdText).trim()
    setError(''); setLoading(true)
    if (!force) setResult(null)
    try {
      const useJd = Boolean(jdOverride) || mode === 'fromjd'
      const payload = useJd
        ? { jd_text: jd, force }
        : { job_title: jobTitle, skills: skills.split(',').map(s => s.trim()).filter(Boolean), experience, force }
      const res = await fetch('/api/boolean-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    setLoading(false)
  }

  // Prefill + auto-generate from an existing job (Job 360 → Boolean Search)
  useEffect(() => {
    if (!initialJobId) {
      setPrefillLoading(false)
      return
    }
    let cancelled = false
    setPrefillLoading(true)
    setMode('fromjd')
    setError('')
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${initialJobId}/screening-context`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? 'Could not load this job JD for Boolean Search')
          setPrefillLoading(false)
          return
        }
        const text = (data.jd_text ?? '').trim()
        setJdText(text)
        setJobTitle(data.title ?? '')
        if (Array.isArray(data.skills) && data.skills.length) {
          setSkills(data.skills.filter(Boolean).join(', '))
        }
        setJobMeta({ title: data.title, client: data.client })
        setPrefillLoading(false)
        if (text && autoRanFor.current !== initialJobId) {
          autoRanFor.current = initialJobId
          setMode('fromjd')
          await submit(false, text)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this job JD for Boolean Search')
          setPrefillLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per job id
  }, [initialJobId])

  function copyStr(key: string, val: string) {
    navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  const boolFields = [
    { key: 'short_boolean', label: 'Short Boolean', color: 'bg-blue-50 border-blue-200' },
    { key: 'advanced_boolean', label: 'Advanced Boolean', color: 'bg-blue-50 border-blue-200' },
    { key: 'alternate_boolean', label: 'Alternate Titles', color: 'bg-green-50 border-green-200' },
    { key: 'linkedin_search', label: 'LinkedIn Search', color: 'bg-sky-50 border-sky-200' },
    { key: 'naukri_search', label: 'Naukri Search', color: 'bg-orange-50 border-orange-200' },
    { key: 'indeed_search', label: 'Indeed Search', color: 'bg-yellow-50 border-yellow-200' },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Boolean Search Generator</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {jobMeta?.title
                ? <>Strings for <span className="font-semibold text-[#166534]">{jobMeta.title}</span>{jobMeta.client ? ` · ${jobMeta.client}` : ''}</>
                : 'LinkedIn, Naukri, Indeed — strings for sourcing in this workspace'}
            </p>
          </div>
        </div>
      </div>

      {prefillLoading && (
        <div className="rounded-xl border border-[#166534]/20 bg-[#ecfdf3] px-4 py-3 text-sm font-semibold text-[#166534] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading this job JD and generating Boolean strings…
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => setMode('simple')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${mode === 'simple' ? 'bg-[#166534] text-white border-transparent shadow-md shadow-green-900/20' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                From Title + Skills
              </button>
              <button onClick={() => setMode('fromjd')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${mode === 'fromjd' ? 'bg-[#166534] text-white border-transparent shadow-md shadow-green-900/20' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                From JD Text
              </button>
            </div>

            {mode === 'simple' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Job Title *</label>
                  <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Full Stack Developer"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#F97316]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Skills (comma-separated)</label>
                  <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, MongoDB"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#F97316]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Experience</label>
                  <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="3+ years"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#F97316]" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Job Description</label>
                <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={6} placeholder="Paste the full JD here to auto-generate boolean strings…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-[#F97316]" />
                <p className="text-xs text-gray-400 mt-2 mb-1">Or upload a JD file (PDF / DOCX / TXT):</p>
                <LightFileUploadZone
                  label="Upload JD (PDF/DOC/DOCX/TXT) — click or drag & drop"
                  accept=".pdf,.docx,.doc,.txt"
                  onText={t => setJdText(prev => prev ? prev + '\n' + t : t)}
                  disabled={loading || prefillLoading}
                />
              </div>
            )}

            {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

            <button onClick={() => submit(false)} disabled={loading || prefillLoading || (mode === 'simple' ? !jobTitle.trim() : !jdText.trim())}
              className="mt-4 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-orange-900/15">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Boolean Strings</>}
            </button>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              {Boolean(result.cached || result.generation) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-600">
                    {result.cached ? 'Last Generated (cached — no tokens used)' : 'Freshly generated'}
                    {typeof (result.generation as { generated_at?: string } | undefined)?.generated_at === 'string'
                      ? ` · ${new Date((result.generation as { generated_at: string }).generated_at).toLocaleString()}`
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-[11px] font-extrabold disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Again
                  </button>
                </div>
              )}
              <h3 className="text-sm font-semibold text-gray-700">Generated Boolean Strings</h3>
              {boolFields.map(({ key, label, color }) => {
                const val = result[key] as string | undefined
                if (!val) return null
                return (
                  <div key={key} className={`rounded-lg border p-3 ${color}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                      <button onClick={() => copyStr(key, val)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-500 hover:bg-white/60 transition-all">
                        {copied === key ? <><Check className="w-3 h-3 text-green-500" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                    </div>
                    <code className="text-xs text-gray-800 break-all leading-relaxed">{val}</code>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-fit">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Searches</h3>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No searches yet</p>
          ) : (
            <div className="space-y-2">
              {history.map(s => (
                <div key={s.id} className="p-2 rounded-lg border border-gray-100 hover:border-gray-300 cursor-pointer transition-all">
                  <p className="text-xs font-medium text-gray-800 truncate">{s.job_title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate font-mono">{s.short_boolean}</p>
                  <p className="text-[10px] text-gray-400">{fmtDate(s.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Engine Tab
// ─────────────────────────────────────────────────────────────────────────────
function ImportTab() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState<Record<string, unknown>[]>([])
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<Record<string, unknown> | null>(null)
  const [batchErrors, setBatchErrors] = useState<Record<string, unknown>[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadBatches() {
    setLoadingBatches(true)
    const res = await fetch('/api/import')
    const data = await res.json()
    setBatches(data.batches ?? [])
    setLoadingBatches(false)
  }

  useEffect(() => { loadBatches() }, [uploadResult])

  async function upload() {
    if (!file) return
    setError(''); setUploading(true); setUploadResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setUploadResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    setUploading(false)
  }

  async function viewBatch(batchId: string) {
    const res = await fetch(`/api/import?batch_id=${batchId}`)
    const data = await res.json()
    setSelectedBatch(data.batch ?? null)
    setBatchErrors(data.errors ?? [])
  }

  const statusColor: Record<string, string> = {
    processing: 'bg-amber-50 text-amber-700 border-amber-200',
    complete: 'bg-green-50 text-green-700 border-green-200',
    partial: 'bg-blue-50 text-blue-700 border-blue-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>
          <Upload className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Import Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bulk import candidates from Naukri, Indeed, LinkedIn, or any CSV export</p>
        </div>
      </div>

      {/* Column Mapping Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-blue-800">Column Mapping Guide</h2>
        </div>
        <p className="text-xs text-blue-700 mb-3">The engine auto-detects columns. For best results, ensure your CSV headers match any of the names below:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { source: 'Naukri Export', cols: ['Name', 'Email', 'Mobile', 'Skills', 'Experience', 'Current Company', 'Current Designation', 'Location'] },
            { source: 'LinkedIn Recruiter', cols: ['First Name', 'Last Name', 'Email Address', 'Headline', 'Skills', 'Company', 'Title', 'City'] },
            { source: 'Indeed / Monster', cols: ['name', 'phone', 'email', 'skills', 'work_experience', 'current_title', 'current_company', 'location'] },
          ] as const).map(({ source, cols }) => (
            <div key={source} className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-700 mb-2">{source}</p>
              <div className="flex flex-wrap gap-1">
                {cols.map(c => <span key={c} className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">{c}</span>)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-blue-600 mt-3">Any unrecognized columns are still imported as raw metadata. You can adjust mappings after reviewing the import results.</p>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Upload Candidate CSV</h2>
        <p className="text-xs text-gray-500 mb-4">
          Accepts CSV exports from Naukri, Indeed, LinkedIn Recruiter, Monster, or any system.
          Auto-detects columns for: name, email, phone, skills, experience, current_company, current_title.
          Max 5 MB.
        </p>
        <div
          className={`srp-dropzone ${file ? 'is-ok' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) setFile(f) }}>
          <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-blue-600' : 'text-gray-400'}`} />
          {file ? (
            <div>
              <p className="text-sm font-medium text-blue-700">{file.name}</p>
              <p className="text-xs text-blue-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB — ready to import</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">Drop a CSV file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Naukri export, Indeed export, LinkedIn export…</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
        {uploadResult && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            <p className="font-semibold">Import started: {uploadResult.batch_ref as string}</p>
            <p className="text-xs mt-0.5">{uploadResult.total_rows as number} rows detected. Processing in background…</p>
            {(uploadResult.detected_columns as string[])?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(uploadResult.detected_columns as string[]).map(c => <span key={c} className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] font-mono">{c}</span>)}
              </div>
            )}
          </div>
        )}

        <button onClick={upload} disabled={!file || uploading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-[#14532d] bg-[#166534]">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4" />Start Import</>}
        </button>
      </div>

      {/* Batch History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Import History</h2>
          <button onClick={loadBatches} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
        </div>
        {loadingBatches ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : batches.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No imports yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {batches.map(b => (
              <div key={b.id as string} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-all">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.filename as string ?? 'Import'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{b.batch_ref as string}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span>Total: {b.total_rows as number}</span>
                    <span className="text-green-600">✓ {b.success_rows as number}</span>
                    <span className="text-amber-600">⟳ {b.skipped_rows as number}</span>
                    <span className="text-red-500">✗ {b.error_rows as number}</span>
                    {!!(b.created_at as string) && <span className="text-gray-400">· {fmtDate(b.created_at as string, true)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${statusColor[b.status as string] ?? statusColor.pending}`}>
                    {b.status as string}
                  </span>
                  <button onClick={() => viewBatch(b.id as string)}
                    className="text-xs text-blue-600 hover:underline">Details</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batch detail modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setSelectedBatch(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Batch: {selectedBatch.batch_ref as string}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Started: {fmtDate(selectedBatch.created_at as string, true)}
                  {selectedBatch.finished_at ? ` · Finished: ${fmtDate(selectedBatch.finished_at as string, true)}` : ' · In progress…'}
                </p>
              </div>
              <button onClick={() => setSelectedBatch(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total', value: selectedBatch.total_rows, color: 'text-gray-900' },
                { label: 'Success', value: selectedBatch.success_rows, color: 'text-green-600' },
                { label: 'Skipped', value: selectedBatch.skipped_rows, color: 'text-amber-600' },
                { label: 'Errors', value: selectedBatch.error_rows, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className={`text-xl font-bold ${color}`}>{value as number}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            {batchErrors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Errors ({batchErrors.length})</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {batchErrors.map((e, i) => (
                    <div key={i} className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs">
                      <span className="font-semibold text-red-700">Row {e.row_number as number}: </span>
                      <span className="text-red-600">{e.error_message as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Hub Tab
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  job_portal:  { label: 'Job Portals',       icon: '🏢' },
  email:       { label: 'Email Providers',   icon: '📧' },
  messaging:   { label: 'Messaging',         icon: '💬' },
  automation:  { label: 'Automation',        icon: '⚡' },
  storage:     { label: 'Cloud Storage',     icon: '☁️' },
}

function IntegrationsTab() {
  const [catalogue, setCatalogue] = useState<Record<string, unknown>[]>([])
  const [integrations, setIntegrations] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function load() {
    setLoading(true); setLoadError('')
    try {
      const [catRes, intRes] = await Promise.all([
        fetch('/api/integrations?catalogue=true').then(r => r.json()),
        fetch('/api/integrations').then(r => r.json()).catch(() => ({ integrations: [] })),
      ])
      setCatalogue(catRes.catalogue ?? [])
      setIntegrations(intRes.integrations ?? [])
    } catch (e) {
      setLoadError('Failed to load integrations. Please refresh.')
      console.error('[integrations]', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function getStatus(id: string) {
    return integrations.find(i => i.connector_id === id)
  }

  function openConfigure(connector: Record<string, unknown>) {
    const existing = getStatus(connector.id as string)
    setSelected(connector)
    // Pre-fill with existing (masked) config so user sees current state
    setFormValues((existing?.config as Record<string, string>) ?? {})
    setShowPasswords({})
    setSaveMsg('')
  }

  async function save() {
    if (!selected) return
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', connector_id: selected.id, config: formValues }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveMsg(`Error: ${data.error}`); return }
    setSaveMsg('Integration saved successfully!')
    load()
    setTimeout(() => { setSelected(null); setFormValues({}); setSaveMsg('') }, 1200)
  }

  async function toggle(intgId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', integration_id: intgId }),
    })
    load()
  }

  async function testTelegram(e: React.MouseEvent) {
    e.stopPropagation()
    setSaveMsg('Testing Telegram…')
    const res = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'telegram' }),
    })
    const data = await res.json()
    setSaveMsg(data.ok ? `Telegram OK (@${data.bot}) · ${data.latency_ms}ms` : `Telegram: ${data.error || data.status}`)
  }

  const categories = [...new Set((catalogue as Record<string, string>[]).map(c => c.category))]
  const connectedCount = integrations.filter(i => i.is_active).length

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500">Loading integrations…</p>
    </div>
  )

  if (loadError) return (
    <div className="max-w-4xl">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">{loadError}</div>
        <button onClick={load} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl space-y-7">
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>Integrations</h1>
            <p className="text-sm text-slate-500 mt-0.5">Connect tools to this workspace only — credentials and toggles never leave your tenant</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {connectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">{connectedCount} connected</span>
            </div>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* How to use guide */}
      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-slate-50 p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">How to use Integrations</h3>
            <p className="text-xs text-blue-700 leading-relaxed mb-3">
              Integrations let SRP SmartRecruit work with the tools you already use. Each connection requires an <strong>API key or credentials</strong> from that service. Here&apos;s how to get started:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { num: '1', title: 'Choose a connector', desc: 'Click any card below. Cards marked "Soon" are coming in the next update.' },
                { num: '2', title: 'Enter your API key', desc: 'Get the API key from that platform\'s settings page. Paste it in the form and save.' },
                { num: '3', title: 'Toggle it on', desc: 'Use the On/Off button to activate or pause the connection anytime without losing credentials.' },
                { num: '4', title: 'Use the connection', desc: 'Email and WhatsApp send from Compose when that provider is connected. n8n stores your webhook for workflows you run — it does not auto-fire after screening.' },
              ].map(step => (
                <div key={step.num} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
                  <span className="w-5 h-5 rounded-full bg-[#166534] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-900">{step.title}</p>
                    <p className="text-[11px] text-blue-600 leading-relaxed mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] bg-white border border-blue-200 text-blue-700 rounded-full px-2.5 py-1 font-semibold">📋 Naukri — post & import jobs</span>
              <span className="text-[11px] bg-white border border-blue-200 text-blue-700 rounded-full px-2.5 py-1 font-semibold">n8n — your webhook, your workflows</span>
              <span className="text-[11px] bg-white border border-blue-200 text-blue-700 rounded-full px-2.5 py-1 font-semibold">📧 Gmail / Outlook — send from Compose</span>
              <span className="text-[11px] bg-white border border-blue-200 text-blue-700 rounded-full px-2.5 py-1 font-semibold">💬 WhatsApp — candidate notifications</span>
            </div>
          </div>
        </div>
      </div>

      {categories.map(cat => {
        const meta = CATEGORY_META[cat] ?? { label: cat, icon: '🔌' }
        const catConnectors = (catalogue as Record<string, unknown>[]).filter(c => c.category === cat)
        return (
          <div key={cat}>
            {/* Category label */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{meta.icon}</span>
              <h2 className="text-sm font-bold text-gray-700">{meta.label}</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{catConnectors.length}</span>
              <div className="flex-1 h-px bg-gray-200 ml-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catConnectors.map(connector => {
                const existing = getStatus(connector.id as string)
                const isActive = existing?.is_active as boolean | undefined
                const isComingSoon = connector.mode === 'coming_soon'
                const hasFields = ((connector.fields as unknown[]) ?? []).filter((f: unknown) => (f as Record<string, string>).type !== 'info').length > 0

                return (
                  <div key={connector.id as string}
                    className={`bg-white rounded-xl border flex flex-col transition-all ${
                      isComingSoon
                        ? 'opacity-55 cursor-not-allowed border-gray-200'
                        : existing
                          ? 'border-emerald-200 hover:border-emerald-300 hover:shadow-sm cursor-pointer'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer'
                    }`}
                    onClick={() => { if (!isComingSoon) openConfigure(connector) }}>

                    <div className="p-4 flex-1">
                      {/* Card top row */}
                      <div className="flex items-start gap-3 mb-3">
                        {/* Flat icon box — no gradients */}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl bg-gray-50 border border-gray-200 flex-shrink-0">
                          {connector.icon as string}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{connector.name as string}</p>
                            {isComingSoon && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 border border-amber-200 flex-shrink-0">Soon</span>
                            )}
                          </div>
                          {existing ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                              <span className={`text-[11px] font-medium ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">Not connected</span>
                          )}
                        </div>
                        {existing && !isComingSoon && (
                          <button
                            onClick={e => toggle(existing.id as string, e)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all flex-shrink-0 ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}>
                            {isActive ? 'On' : 'Off'}
                          </button>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{connector.description as string}</p>

                      {/* Required fields pills */}
                      {hasFields && !isComingSoon && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {((connector.fields as Record<string, string>[]) ?? [])
                            .filter(f => f.type !== 'info')
                            .slice(0, 3)
                            .map(f => (
                              <span key={f.name} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1">
                                {f.type === 'password' && <Key className="w-2.5 h-2.5" />}
                                {f.label}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    {!isComingSoon && (
                      <div className={`px-4 py-2.5 rounded-b-xl border-t flex items-center justify-between ${
                        existing ? 'bg-emerald-50/40 border-emerald-100' : 'bg-gray-50 border-gray-100'
                      }`}>
                        {existing ? (
                          <>
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Connected
                            </span>
                            <span className="text-xs text-blue-600 font-semibold hover:underline">Edit →</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-400">API keys required</span>
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                              <Settings className="w-3 h-3" /> Connect
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Config modal */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl bg-gray-50 border border-gray-200">
                  {selected.icon as string}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selected.name as string}</h3>
                  <p className="text-xs text-gray-400">Enter your credentials to connect</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="px-6 pt-4 pb-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 leading-relaxed">{selected.description as string}</p>
              </div>
            </div>

            {/* Fields */}
            <div className="px-6 py-4 space-y-4">
              {((selected.fields as Record<string, string>[]) ?? []).map(field => (
                <div key={field.name}>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">{field.label}</label>
                  {field.type === 'info' ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">{field.label}</p>
                    </div>
                  ) : field.type === 'password' ? (
                    <div className="relative">
                      <input
                        type={showPasswords[field.name] ? 'text' : 'password'}
                        value={formValues[field.name] ?? ''}
                        onChange={e => setFormValues(v => ({ ...v, [field.name]: e.target.value }))}
                        placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                        className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(v => ({ ...v, [field.name]: !v[field.name] }))}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formValues[field.name] ?? ''}
                      onChange={e => setFormValues(v => ({ ...v, [field.name]: e.target.value }))}
                      placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                  )}
                </div>
              ))}
            </div>

            {/* Save message */}
            {saveMsg && (
              <div className={`mx-6 mb-2 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                saveMsg.startsWith('Error')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {saveMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                {saveMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setSelected(null); setSaveMsg('') }}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-all">
                Cancel
              </button>
              {selected.id === 'telegram' && (
                <button type="button" onClick={testTelegram}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Test Connection
                </button>
              )}
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#166534] text-white text-sm font-bold disabled:opacity-50 hover:bg-[#14532d] transition-all flex items-center justify-center gap-2 shadow-sm">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : <><Key className="w-4 h-4" />Save & Connect</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication Hub Tab
// ─────────────────────────────────────────────────────────────────────────────
// ── Main Dashboard ─────────────────────────────────────────────────────────────

/** Quick-access shortcuts into existing AI Hub / tool tabs (no new routes). */
type AiShortcut = {
  id: string
  label: string
  icon: typeof Sparkles
  tooltip: string
  tab: DashboardTab
  badge?: string | null
  templateId?: string
}

const AI_SHORTCUTS: AiShortcut[] = [
  { id: 'hub', label: 'AI Hub', icon: Sparkles, tooltip: 'Central AI workspace', tab: 'coach', badge: 'AI' },
  { id: 'screen', label: 'AI Screening', icon: Brain, tooltip: 'Score CVs against a job description', tab: 'screen', badge: 'AI' },
  { id: 'boolean', label: 'Boolean Search', icon: Search, tooltip: 'Generate job-board Boolean strings', tab: 'boolean' },
  { id: 'compose', label: 'AI Composer', icon: Mail, tooltip: 'Draft emails and messages', tab: 'compose' },
  { id: 'jd', label: 'JD Writer', icon: FileText, tooltip: 'Create or optimize job descriptions', tab: 'jd' },
  { id: 'gen-post', label: 'Generate Job Post', icon: PenLine, tooltip: 'Open Jobs — Generate Post from Job Hub', tab: 'jobs' },
]

export default function DashboardPage() {
  const { data: session, status } = useSession()

  // Sync tracked session cookie for Security Center terminate/heartbeat
  useEffect(() => {
    if (status === 'authenticated') {
      void fetch('/api/security/session-cookie', { method: 'POST' }).catch(() => {})
    }
  }, [status, session])

  // Apply saved appearance (theme + typography) from localStorage
  useEffect(() => {
    applyAppearance()
  }, [])
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<DashboardTab>('workspace')
  const [settingsPanel, setSettingsPanel] = useState<'main' | 'integrations' | 'governance' | 'security'>('main')
  /** Expandable AI Tools sidebar (shortcuts into existing Hub tabs) */
  const [aiNavExpanded, setAiNavExpanded] = useState(true)
  const [aiNavQuery, setAiNavQuery] = useState('')
  const [activeAiShortcutId, setActiveAiShortcutId] = useState<string | null>(null)
  /** Optional coach template to apply when opening AI Assistant / Hub */
  const [coachBootstrapTemplateId, setCoachBootstrapTemplateId] = useState<string | null>(null)
  /** Lightweight UI CTA hints (no new routes/APIs). */
  const [pendingAiAction, setPendingAiAction] = useState<string | null>(null)

  const filteredAiShortcuts = useMemo(() => {
    const q = aiNavQuery.trim().toLowerCase()
    if (!q) return AI_SHORTCUTS
    return AI_SHORTCUTS.filter(s => s.label.toLowerCase().includes(q) || s.tooltip.toLowerCase().includes(q))
  }, [aiNavQuery])

  const openAiShortcut = useCallback((s: AiShortcut) => {
    setActiveAiShortcutId(s.id)
    setCoachBootstrapTemplateId(s.templateId ?? null)
    if (s.tab === 'boolean') setBooleanJobId(null)
    setActiveTab(s.tab)
    setPendingAiAction(s.id === 'gen-post' ? 'gen-post' : null)
    setMobileNavOpen(false)
  }, [])

  const isAiShortcutActive = useCallback((s: AiShortcut) => {
    if (activeAiShortcutId) return activeAiShortcutId === s.id
    if (s.tab !== activeTab) return false
    if (s.tab === 'screen') return s.id === 'screen'
    if (s.tab === 'compose') return s.id === 'compose'
    if (s.tab === 'jd') return s.id === 'jd'
    if (s.tab === 'boolean') return s.id === 'boolean'
    if (s.tab === 'coach') return s.id === 'hub'
    return false
  }, [activeTab, activeAiShortcutId])

  const goTab = useCallback((tab: DashboardTab) => {
    setActiveAiShortcutId(null)
    setCoachBootstrapTemplateId(null)
    setPendingAiAction(null)
    if (tab === 'boolean') setBooleanJobId(null)
    setActiveTab(tab)
    setMobileNavOpen(false)
  }, [])

  // Phase 3.2: collapse duplicate / hidden tabs into primary destinations
  // Keep `performance` reachable (My Performance) — do not redirect it to reports.
  useEffect(() => {
    if (activeTab === 'pipeline') setActiveTab('candidates')
    else if (activeTab === 'analytics') setActiveTab('reports')
    else if (activeTab === 'integrations') {
      setSettingsPanel('integrations')
      setActiveTab('settings')
    }
    else if (activeTab === 'governance') {
      setSettingsPanel('governance')
      setActiveTab('settings')
    }
  }, [activeTab])

  const mainScrollRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  const isWideTab = useMemo(
    () => ['workspace', 'candidates', 'talent', 'jobs', 'screen', 'compose', 'jd', 'boolean', 'submissions', 'interviews', 'followups', 'selected', 'clients', 'reports', 'performance', 'recruiters', 'documents', 'coach', 'comms', 'ess', 'hrconfig', 'settings', 'import'].includes(activeTab),
    [activeTab],
  )
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])

  const duplicateEmailKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const cand of candidates) {
      const e = (cand.candidate_email ?? '').trim().toLowerCase()
      if (!e) continue
      counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    const dups = new Set<string>()
    counts.forEach((n, email) => {
      if (n > 1) dups.add(email)
    })
    return dups
  }, [candidates])
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterMatch, setFilterMatch] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [filterDate, setFilterDate] = useState('')  // 'today' | 'week' | 'month' | 'year' | ...
  const [filterHireType, setFilterHireType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterRecruiter, setFilterRecruiter] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterLifecycle, setFilterLifecycle] = useState('')
  const [filterVisa, setFilterVisa] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [candPage, setCandPage] = useState(1)
  const [candTotal, setCandTotal] = useState(0)
  const [candTotalPages, setCandTotalPages] = useState(1)
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null)
  const [submissionCandidate, setSubmissionCandidate] = useState<Candidate | null>(null)
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null)
  const [exportingTracker, setExportingTracker] = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([])
  const [visibleCandCols, setVisibleCandCols] = useState<Set<CandidateColumnKey>>(() => loadCandidateColumnPrefs())
  const candColSpan = 1 + CANDIDATE_COLUMNS.filter(c => visibleCandCols.has(c.key)).length
  const showCandCol = (k: CandidateColumnKey) => visibleCandCols.has(k)
  const [filterJobStatus, setFilterJobStatus] = useState('')
  const [filterJobType, setFilterJobType] = useState('')
  const [filterJobRole, setFilterJobRole] = useState('')
  const [filterJobCompany, setFilterJobCompany] = useState('')
  const [selectedJobView, setSelectedJobView] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [allocateFor, setAllocateFor] = useState<Candidate | null>(null)
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({})
  const [topSkills, setTopSkills] = useState<Array<{ skill: string; count: number }>>([])

  // New Job modal state
  const [showNewJob, setShowNewJob] = useState(false)
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', optional_requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
  const [savingJob, setSavingJob] = useState(false)


  // New Candidate modal state
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [newCand, setNewCand] = useState({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '', nric: '' })
  const [savingCand, setSavingCand] = useState(false)
  const [candDupWarning, setCandDupWarning] = useState<CandDupExisting | null>(null)
  const [candResumeFile, setCandResumeFile] = useState<File | null>(null)
  const [candResumeParsing, setCandResumeParsing] = useState(false)
  const [candResumeText, setCandResumeText] = useState('')
  const [candResumeError, setCandResumeError] = useState('')

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // AI Screen state
  const [screenMode, setScreenMode] = useState<'single' | 'bulk' | 'existing'>('single')
  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [bulkTexts, setBulkTexts] = useState<Array<{ text: string; filename: string; file?: File }>>([])
  /** Original file from last single-mode upload (used to persist PDF after AI screen saves a row). */
  const [screenSingleFile, setScreenSingleFile] = useState<File | null>(null)
  const [screenJobId, setScreenJobId] = useState('')
  const [booleanJobId, setBooleanJobId] = useState<string | null>(null)
  const [screenJobMeta, setScreenJobMeta] = useState<{ title?: string; client?: string | null; loading?: boolean } | null>(null)
  const [screening, setScreening] = useState(false)
  const screenRunIdRef = useRef(0)
  const [screenProgress, setScreenProgress] = useState('')
  const [screenError, setScreenError] = useState('')
  const [screenResults, setScreenResults] = useState<ScreenResult[]>([])
  // "Screen from Candidates" mode
  const [selectedCandIds, setSelectedCandIds] = useState<string[]>([])

  // Deep-link: ?tab=screen&job_post_id=… from Job Hub action cards
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const jobId = params.get('job_post_id')
    const aiAction = params.get('ai_action')
    const validTabs: DashboardTab[] = [
      'workspace', 'pipeline', 'candidates', 'submissions', 'interviews', 'followups', 'selected',
      'performance', 'coach', 'clients', 'recruiters', 'documents', 'reports', 'governance',
      'screen', 'compose', 'jobs', 'analytics', 'settings', 'jd', 'boolean', 'import', 'integrations',
      'comms', 'ess', 'hrconfig', 'talent',
    ]
    if (tab && validTabs.includes(tab as DashboardTab)) setActiveTab(tab as DashboardTab)

    if (aiAction === 'gen-post' && (!tab || tab === 'jobs')) {
      setPendingAiAction('gen-post')
      setActiveAiShortcutId('gen-post')
      setCoachBootstrapTemplateId(null)
    }
    if (jobId && (!tab || tab === 'screen')) {
      setScreenJobId(jobId)
      if (!tab) setActiveTab('screen')
      void (async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}/screening-context`)
          const data = await res.json()
          if (res.ok && data.jd_text) {
            setJdText(data.jd_text)
            setScreenJobMeta({ title: data.title, client: data.client, loading: false })
          }
        } catch { /* ignore */ }
      })()
    }
    if (jobId && tab === 'boolean') {
      setBooleanJobId(jobId)
      setActiveTab('boolean')
    }
  }, [])
  const [skipAlreadyScreened, setSkipAlreadyScreened] = useState(true)
  const [existingCandSearch, setExistingCandSearch] = useState('')

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
  const [genPostOpen, setGenPostOpen] = useState(false)
  const [genPostMode, setGenPostMode] = useState<'existing' | 'quick'>('existing')
  const [quickJdText, setQuickJdText] = useState('')
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCompany, setQuickCompany] = useState('')
  const [quickLocation, setQuickLocation] = useState('')
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [generatedPosts, setGeneratedPosts] = useState<Record<string, string>>({})
  const [genPostError, setGenPostError] = useState('')
  const [genPostTab, setGenPostTab] = useState('linkedin')
  const [genCustomPrompt, setGenCustomPrompt] = useState('')
  const [genPostPlatforms, setGenPostPlatforms] = useState<JobPostPlatform[]>([...JOB_POST_PLATFORMS])
  const [copiedPostKey, setCopiedPostKey] = useState('')
  const [autoGeneratePosts, setAutoGeneratePosts] = useState(false)

  // Upgrade prompt state
  const [upgradePrompt, setUpgradePrompt] = useState<{ show: boolean; message: string; feature: string }>({ show: false, message: '', feature: '' })
  const [subAlertDismissed, setSubAlertDismissed] = useState(false)
  /** Short-lived confirmation after job save, screening, posts generation, etc. */
  const [workspaceBanner, setWorkspaceBanner] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceBanner) return
    const id = window.setTimeout(() => setWorkspaceBanner(null), 6000)
    return () => clearTimeout(id)
  }, [workspaceBanner])

  // Profile / Settings state
  const [profileData, setProfileData] = useState<{
    user: { id: string; name: string; email: string; image: string | null; provider: string; role: string; created_at: string }
    subscription: {
      plan: string; status: string; billing_cycle: string; current_period_end: string | null; trial_ends_at: string | null
      retention?: {
        phase: string
        period_end: string | null
        purge_eligible_after: string | null
        days_until_purge_eligible: number | null
        banner: string | null
      }
    }
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
  // Audit trail state (Phase 10)
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; resource_type: string; resource_id: string | null; result: string; created_at: string }[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  // Team management state
  const [teamMembers, setTeamMembers] = useState<{ id: string; user_id: string; name: string | null; email: string; role: string; invite_accepted: boolean; last_active_at: string | null; created_at: string }[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('recruiter')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [tenantRole, setTenantRole] = useState<string | null>(null)
  const [tenantPermissions, setTenantPermissions] = useState<{
    analytics?: { tenant?: boolean }
    candidates?: { delete?: boolean }
    jobs?: { delete?: boolean }
  } | null>(null)
  const [tenantFunnel, setTenantFunnel] = useState<{ funnel: Record<string, number>; submission_stages: Record<string, number>; period_days: number } | null>(null)
  const [tenantFunnelLoading, setTenantFunnelLoading] = useState(false)
  const [agentPendingCount, setAgentPendingCount] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    const loadAgents = () => {
      fetch('/api/agents?status=pending&limit=50')
        .then(r => r.json())
        .then(d => { if (!cancelled) setAgentPendingCount((d.suggestions ?? []).length) })
        .catch(() => { /* ignore */ })
    }
    loadAgents()
    const t = setInterval(loadAgents, 120000)
    return () => { cancelled = true; clearInterval(t) }
  }, [status])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  // Resolve tenant role + permissions for sidebar filtering
  useEffect(() => {
    if (status !== 'authenticated') return
    const sessionRole = (session?.user as { tenantRole?: string } | undefined)?.tenantRole
    if (sessionRole) setTenantRole(sessionRole)

    fetch('/api/tenant')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (data.myRole) setTenantRole(data.myRole)
        if (data.myPermissions) setTenantPermissions(data.myPermissions)
      })
      .catch(() => { /* ignore */ })

    loadTeamMembers()
  }, [status, session?.user])

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
      if (filterDate) params.set('date_range', filterDate)
      if (filterHireType) params.set('hire_type', filterHireType)
      if (filterSource) params.set('source', filterSource)
      if (filterRecruiter) params.set('recruiter_id', filterRecruiter)
      if (filterClient) params.set('client', filterClient)
      if (filterLifecycle) params.set('lifecycle', filterLifecycle)
      if (filterVisa) params.set('visa_type', filterVisa)
      if (filterLocation) params.set('location', filterLocation)
      params.set('page', String(candPage))
      params.set('limit', '50')

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
        setCandTotal(cData.total ?? (cData.candidates ?? []).length)
        setCandTotalPages(cData.totalPages ?? 1)
      }
    } finally {
      setLoading(false)
    }
  }, [searchQ, filterStage, filterMatch, filterJob, filterSkill, selectedJob, filterDate, filterHireType, filterSource, filterRecruiter, filterClient, filterLifecycle, filterVisa, filterLocation, candPage])

  const applyCandidatePatch = useCallback((id: string, patch: Partial<Candidate>) => {
    setCandidates(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)))
    setSelectedCandidate(prev => (prev?.id === id ? { ...prev, ...patch } : prev))
    setEditCandidate(prev => (prev?.id === id ? { ...prev, ...patch } : prev))
    setSubmissionCandidate(prev => (prev?.id === id ? { ...prev, ...patch } : prev))
  }, [])

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

  const loadAuditLogs = async () => {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/audit?limit=50')
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs ?? [])
      }
    } catch { /* ignore */ } finally {
      setAuditLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    setTeamLoading(true)
    try {
      const res = await fetch('/api/tenant/members')
      if (res.ok) {
        const data = await res.json()
        setTeamMembers(data.members ?? [])
      }
    } catch { /* ignore */ } finally {
      setTeamLoading(false)
    }
  }

  const sendTeamInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteResult(null)
    try {
      const res = await fetch('/api/tenant/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (res.ok) {
        const emailNote = data.emailSent === false
          ? ' Invite created, but email could not be sent — share the invite link manually.'
          : data.emailSent === true
            ? ' Invitation email sent.'
            : ''
        setInviteResult({
          ok: true,
          message: `Invite created for ${inviteEmail.trim()} as ${inviteRole}.${emailNote}${data.inviteLink ? ` Link: ${data.inviteLink}` : ''}`,
        })
        setInviteEmail('')
        loadTeamMembers()
      } else {
        setInviteResult({ ok: false, message: data.error ?? 'Failed to send invite' })
      }
    } catch { setInviteResult({ ok: false, message: 'Network error' }) } finally {
      setInviting(false)
    }
  }

  const changeMemberRole = async (memberId: string, role: string) => {
    try {
      const res = await fetch('/api/tenant/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setInviteResult({ ok: true, message: `Role updated to ${role}.` })
        loadTeamMembers()
      } else {
        setInviteResult({ ok: false, message: data.error ?? 'Could not update role' })
      }
    } catch {
      setInviteResult({ ok: false, message: 'Network error updating role' })
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return
    try {
      const res = await fetch(`/api/tenant/members?memberId=${memberId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setInviteResult({ ok: true, message: 'Member removed.' })
        loadTeamMembers()
      } else {
        setInviteResult({ ok: false, message: data.error ?? 'Could not remove member' })
      }
    } catch {
      setInviteResult({ ok: false, message: 'Network error removing member' })
    }
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
    if (activeTab === 'settings') { loadApiKeys(); loadIntegrations(); loadAuditLogs(); loadTeamMembers() }
    if (activeTab === 'candidates') { loadTeamMembers() }
  }, [activeTab])

  // Derive tenant role from team members when not available from session/API
  useEffect(() => {
    if (tenantRole || !session?.user?.email || teamMembers.length === 0) return
    const me = teamMembers.find(m => m.email.toLowerCase() === session.user!.email!.toLowerCase())
    if (me?.role) setTenantRole(me.role)
  }, [tenantRole, session?.user, teamMembers])

  // Fetch tenant-wide funnel for admin/owner analytics view
  useEffect(() => {
    if (activeTab !== 'analytics') return
    const isAdminOrOwner = tenantRole === 'owner' || tenantRole === 'admin'
    if (!isAdminOrOwner) return
    let cancelled = false
    setTenantFunnelLoading(true)
    fetch('/api/analytics/tenant?days=90')
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) setTenantFunnel(await res.json())
        else setTenantFunnel(null)
      })
      .catch(() => { if (!cancelled) setTenantFunnel(null) })
      .finally(() => { if (!cancelled) setTenantFunnelLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, tenantRole])

  const createJob = async () => {
    if (!newJob.title) return
    setSavingJob(true)
    try {
      const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newJob) })
      const data = await res.json()
      if (res.status === 403) {
        setSavingJob(false)
        setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Posts' })
        return
      }
      if (!res.ok) {
        setSavingJob(false)
        alert(data.error || 'Failed to create job post. Please try again.')
        return
      }
      setSavingJob(false)
      const savedTitle = newJob.title.trim()
      setShowNewJob(false)
      setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', optional_requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
      setFilterJobStatus('')
      setFilterJobType('')
      setFilterJobRole('')
      setFilterJobCompany('')
      await loadData()
      setWorkspaceBanner(`Job post saved: ${savedTitle}`)
    } catch (err) {
      setSavingJob(false)
      alert('Network error. Please check your connection and try again.')
      console.error('[createJob]', err)
    }
  }

  const createAndGenerate = async () => {
    if (!newJob.title) return
    setSavingJob(true)
    try {
      const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newJob) })
      const data = await res.json()
      if (res.status === 403) {
        setSavingJob(false)
        setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Posts' })
        return
      }
      if (!res.ok) {
        setSavingJob(false)
        alert(data.error || 'Failed to create job post. Please try again.')
        return
      }
      setSavingJob(false)
      const savedTitle = newJob.title.trim()
      setShowNewJob(false)
      setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', optional_requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
      setFilterJobStatus('')
      setFilterJobType('')
      setFilterJobRole('')
      setFilterJobCompany('')
      await loadData()
      if (data.job) {
        setGenPostMode('existing')
        setGenPostJob(data.job)
        setGenPostOpen(true)
        setGeneratedPosts({}); setGenCustomPrompt(''); setGenPostError('')
        setWorkspaceBanner(`Job post saved: ${savedTitle}. Generate social posts below when you are ready.`)
      } else {
        setWorkspaceBanner(`Job post saved: ${savedTitle}`)
      }
    } catch (err) {
      setSavingJob(false)
      alert('Network error. Please check your connection and try again.')
      console.error('[createAndGenerate]', err)
    }
  }



  const handleCandResumeUpload = async (file: File) => {
    setCandResumeFile(file)
    setCandResumeError('')
    setCandResumeText('')
    setCandResumeParsing(true)
    try {
      const data = await parseUploadedFile(file)
      setCandResumeText(data.text ?? '')
      setNewCand(p => ({
        ...p,
        candidate_name: p.candidate_name || data.name || '',
        candidate_email: p.candidate_email || data.email || '',
        candidate_phone: p.candidate_phone || data.phone || '',
      }))
      if (!data.name && !data.email) {
        setCandResumeError('Resume parsed, but name/email were not detected — please fill them manually before saving.')
      }
    } catch (e) {
      setCandResumeError(e instanceof Error ? e.message : 'Could not read this resume — paste the text instead')
    }
    finally { setCandResumeParsing(false) }
  }

  const createCandidate = async () => {
    if (!newCand.candidate_name?.trim()) {
      setCandResumeError('Candidate name is required. Upload a resume or enter the name manually.')
      return
    }
    setSavingCand(true)
    setCandDupWarning(null)
    const payload = {
      candidate_name: newCand.candidate_name,
      candidate_email: newCand.candidate_email,
      candidate_phone: newCand.candidate_phone,
      job_post_id: newCand.job_post_id || undefined,
      ai_skills: newCand.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
      raw_text: candResumeText || undefined,
      file_name: candResumeFile?.name || undefined,
      file_size_bytes: candResumeFile?.size || undefined,
      candidate_profile: newCand.nric.trim()
        ? { nric: newCand.nric.trim(), id_document_type: 'NRIC', id_document_reference: newCand.nric.trim(), nationality: 'Malaysian' }
        : undefined,
    }
    try {
      const res = await fetch('/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (res.status === 409 && data.is_duplicate) {
        setCandDupWarning(data.existing)
        setSavingCand(false)
        return
      }
      if (!res.ok) {
        setCandResumeError(data.error ?? 'Failed to add candidate')
        setSavingCand(false)
        return
      }
      const newId = data.candidate?.id as string | undefined
      if (newId && candResumeFile) {
        try {
          const fd = new FormData()
          fd.append('file', candResumeFile)
          const up = await fetch(`/api/candidates/${newId}/resume-file`, { method: 'POST', body: fd })
          if (!up.ok) {
            const uj = await up.json().catch(() => ({}))
            console.warn('[createCandidate] resume file attach failed', uj)
          }
        } catch {
          console.warn('[createCandidate] resume file attach network error')
        }
      }
    } catch {
      setCandResumeError('Network error — please try again')
      setSavingCand(false)
      return
    }
    setSavingCand(false)
    setShowNewCandidate(false)
    setCandDupWarning(null)
    const addedName = newCand.candidate_name.trim()
    setNewCand({ candidate_name: '', candidate_email: '', candidate_phone: '', ai_skills: '', job_post_id: '', nric: '' })
    setCandResumeFile(null); setCandResumeText(''); setCandResumeError('')
    loadData()
    setWorkspaceBanner(`Candidate saved to your workspace: ${addedName}`)
  }

  const moveStage = async (candidateId: string, stage: string) => {
    const mapped = new Set(['submitted', 'interview', 'offer', 'hr_onboarding', 'joined'])
    if (mapped.has(stage)) {
      const row = candidates.find(c => c.id === candidateId) ?? selectedCandidate
      if (row) setAllocateFor(row)
      return
    }
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
    // Keep job view candidate list in sync
    setSelectedJobView(prev => prev ? { ...prev } : null)
    await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_post_id: jobId || null }),
    })
  }

  const runScreening = async () => {
    const runId = ++screenRunIdRef.current
    setScreening(true); setScreenError(''); setScreenProgress('Preparing resumes…')
    // Keep prior results visible until new ones arrive (avoids blank flash / race clears)
    try {
      let resumes: Array<{ text: string; filename: string; id?: string }>
      if (screenMode === 'single') {
        resumes = [{ text: resumeText, filename: screenSingleFile?.name ?? 'pasted_resume' }]
        setScreenProgress('Running AI screening on 1 resume…')
      } else if (screenMode === 'bulk') {
        resumes = bulkTexts
        setScreenProgress(`Queueing ${bulkTexts.length} resume${bulkTexts.length === 1 ? '' : 's'} for AI screening…`)
      } else {
        // existing mode: pull raw_text from already-loaded candidates
        const toScreen = candidates.filter(c =>
          selectedCandIds.includes(c.id) && c.raw_text
        )
        resumes = toScreen.map(c => ({
          text: c.raw_text!,
          filename: c.file_name ?? c.candidate_name ?? 'candidate',
          id: c.id,
        }))
        if (!resumes.length) {
          setScreenError('No candidates selected or selected candidates have no stored CV text.')
          setScreening(false)
          setScreenProgress('')
          return
        }
        setScreenProgress(`Re-screening ${resumes.length} candidate${resumes.length === 1 ? '' : 's'}…`)
      }

      // Large bulk → async queue (P5) to avoid gateway timeouts
      if (screenMode === 'bulk' && resumes.length > 15) {
        const queueRes = await fetch('/api/bulk-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd_text: jdText || undefined,
            job_post_id: screenJobId || undefined,
            resumes,
          }),
        })
        const queueRaw = await queueRes.text()
        let queueData: { error?: string; bulk_job_id?: string } = {}
        try {
          queueData = queueRaw.trim() ? JSON.parse(queueRaw) : {}
        } catch {
          setScreenError('Could not queue bulk screening (invalid server response).')
          return
        }
        if (!queueRes.ok) {
          setScreenError(queueData.error || 'Could not queue bulk screening')
          return
        }
        const bulkId = queueData.bulk_job_id as string
        setScreenProgress(`Queued ${resumes.length} CVs — processing in background…`)
        // Poll progress
        const etaSeconds = Math.ceil(resumes.length / 5) * 45
        const pollBudgetSeconds = etaSeconds + 300 // buffer for slow screening / retries
        const maxTicks = Math.min(900, Math.ceil(pollBudgetSeconds / 3))
        let bulkTerminal = false
        for (let tick = 0; tick < maxTicks; tick++) {
          if (runId !== screenRunIdRef.current) return
          await new Promise(r => setTimeout(r, 3000))
          if (runId !== screenRunIdRef.current) return
          const st = await fetch(`/api/bulk-jobs?id=${bulkId}`)
          const stRaw = await st.text()
          let stData: { job?: { status?: string; completed?: number; total?: number; failed?: number; skipped?: number }; items?: Array<{ status?: string; error?: string | null; result_json?: unknown; file_name?: string | null; candidate_id?: string | null }> } = {}
          try {
            stData = stRaw.trim() ? JSON.parse(stRaw) : {}
          } catch {
            continue
          }
          const job = stData.job
          if (!job) break
          const completed = job.completed ?? 0
          const total = job.total ?? 0
          const failed = job.failed ?? 0
          const skipped = job.skipped ?? 0
          setScreenProgress(
            `Bulk ${job.status}: ${completed}/${total} done · ${failed} failed · ${skipped} skipped`,
          )
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            bulkTerminal = true
            if (runId !== screenRunIdRef.current) return
            if (failed > 0) {
              const items = Array.isArray(stData.items) ? stData.items : []
              const examples = items
                .filter(i => i.status === 'failed' && (i.error ?? '').trim())
                .slice(0, 3)
                .map(i => String(i.error).trim())
              setScreenError(
                `${failed} item(s) failed. ${examples.length ? `Examples: ${examples.join(' | ')}` : `Retry from bulk job ${bulkId}`}`,
              )
            } else {
              setScreenError('')
            }
            const items = Array.isArray(stData.items) ? stData.items : []
            const fromBulk = items
              .filter(i => i.status === 'done' && i.result_json && typeof i.result_json === 'object')
              .map((i, idx) => {
                const row = i.result_json as ScreenResult
                return {
                  ...row,
                  db_id: row.db_id || i.candidate_id || undefined,
                  filename: row.filename || i.file_name || undefined,
                  persisted: Boolean(row.db_id || i.candidate_id),
                  draft: !row.db_id && !i.candidate_id,
                  _draftKey: `${i.file_name || row.filename || 'resume'}-${idx}`,
                } as ScreenResult & { _draftKey: string }
              })
            if (fromBulk.length) {
              setScreenResults(fromBulk)
              setWorkspaceBanner(
                `${fromBulk.length} screening result${fromBulk.length === 1 ? '' : 's'} ready — scroll down or open Candidates.`,
              )
            } else if (completed > 0) {
              setWorkspaceBanner(
                `${completed} candidate${completed === 1 ? '' : 's'} screened and saved. Open Candidates to view them.`,
              )
            }
            await loadData()
            break
          }
        }
        if (!bulkTerminal && runId === screenRunIdRef.current) {
          setScreenError(`Bulk screening timed out waiting for job ${bulkId}. Check Candidates — some may already be saved.`)
        }
        return
      }

      const controller = new AbortController()
      const timeoutMs = Math.min(
        300000,
        Math.max(180000, Math.ceil(resumes.length / 5) * 90000),
      )
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        setScreenProgress(prev => `${prev.replace(/\.\.\.$/, '')} — calling AI auditor…`)
        const res = await fetch('/api/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd_text: jdText,
            resumes,
            job_post_id: screenJobId || undefined,
            // New uploads stay draft until Save Candidate; existing candidates update in place
            persist: screenMode === 'existing',
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)
        // Safe JSON parse — guards against empty / truncated responses
        const rawText = await res.text()
        let data: { results?: ScreenResult[]; error?: string } = {}
        if (rawText.trim()) {
          try { data = JSON.parse(rawText) } catch {
            setScreenError('Received an invalid response from the server. Please try again.')
            return
          }
        }
        if (res.status === 403) {
          setUpgradePrompt({ show: true, message: data.error || 'You have reached your AI screening limit.', feature: 'AI Screening' })
          return
        }
        if (!res.ok) { setScreenError(data.error ?? `Server error (${res.status}). Please try again.`); return }
        if (runId !== screenRunIdRef.current) return
        const results = data.results ?? []
        const failed = results.filter(r => r && typeof r === 'object' && 'error' in r && r.error)
        // Enrich by original index BEFORE filtering failures (avoids wrong CV text on Save)
        const enriched = results.map((r, idx) => {
          const source = resumes[idx]
          if (!r || typeof r !== 'object') return r
          return {
            ...r,
            raw_text: (r as ScreenResult).raw_text || source?.text || (screenMode === 'single' ? resumeText : '') || '',
            filename: (r as ScreenResult).filename || source?.filename,
            _draftKey: `${source?.filename || (r as ScreenResult).filename || 'resume'}-${idx}`,
          }
        })
        const successResults = enriched.filter(r => !(r && typeof r === 'object' && 'error' in r && (r as ScreenResult).error)) as ScreenResult[]
        setScreenResults(successResults)
        if (failed.length > 0 && successResults.length > 0) {
          setScreenError(`${failed.length} resume(s) could not be screened. Showing ${successResults.length} successful result(s).`)
        } else if (failed.length > 0 && successResults.length === 0) {
          setScreenError('No resumes could be screened. Please try again with fewer files or check your AI configuration.')
          setScreenProgress('')
          return
        }
        const drafts = successResults.filter(r => r.draft || (!r.db_id && !r.persisted))
        const saved = successResults.filter(r => r.db_id || r.persisted)
        setScreenProgress(
          successResults.length
            ? drafts.length && !saved.length
              ? `Completed — ${drafts.length} preview${drafts.length === 1 ? '' : 's'} ready (Save to keep)`
              : saved.length && !drafts.length
                ? `Completed — ${saved.length} result${saved.length === 1 ? '' : 's'} updated`
                : `Completed — ${saved.length} saved, ${drafts.length} draft${drafts.length === 1 ? '' : 's'}`
            : '',
        )
        if (successResults.length > 0) {
          // Attach original files only when already persisted (existing-candidate re-screen)
          const attachJobs: Promise<unknown>[] = []
          if (screenMode === 'existing') {
            for (const result of successResults) {
              const id = result?.db_id
              if (!id) continue
              // no local file for existing mode
            }
          } else if (screenMode === 'single' && saved[0]?.db_id && screenSingleFile) {
            const id = saved[0].db_id
            const fd = new FormData()
            fd.append('file', screenSingleFile)
            attachJobs.push(
              fetch(`/api/candidates/${id}/resume-file`, { method: 'POST', body: fd }).then(async up => {
                if (!up.ok) console.warn('[screen] attach original resume failed', id, await up.text().catch(() => ''))
              }),
            )
          } else if (screenMode === 'bulk') {
            for (const result of saved) {
              const id = result?.db_id
              const file = bulkTexts.find(b => b.filename === result.filename)?.file
              if (!id || !file) continue
              const fd = new FormData()
              fd.append('file', file)
              attachJobs.push(
                fetch(`/api/candidates/${id}/resume-file`, { method: 'POST', body: fd }).then(async up => {
                  if (!up.ok) console.warn('[screen] attach original resume failed', id, await up.text().catch(() => ''))
                }),
              )
            }
          }
          try {
            await Promise.all(attachJobs)
          } catch (e) {
            console.warn('[screen] resume file attach error', e)
          }
          if (saved.length) await loadData()
          if (drafts.length && !saved.length) {
            setWorkspaceBanner(
              drafts.length === 1
                ? 'AI screening preview ready — Save Candidate to store in your workspace, or Discard.'
                : `${drafts.length} screening previews ready — Save each candidate to keep, or Discard.`,
            )
          } else if (saved.length) {
            setWorkspaceBanner(
              saved.length === 1
                ? 'AI screening complete — candidate updated in your workspace.'
                : `AI screening complete — ${saved.length} candidates updated.`,
            )
          }
        }
      } catch (fetchErr) {
        clearTimeout(timer)
        throw fetchErr
      }
    } catch (e) {
      const msg = String(e)
      if (msg.includes('AbortError') || msg.includes('aborted')) {
        setScreenError('Screening is taking longer than expected. Please try again in a moment.')
      } else if (msg.includes('Unexpected end of JSON') || msg.includes('JSON')) {
        setScreenError('Server returned an empty or invalid response. Please try again — if this persists, re-upload the CV as PDF/DOCX.')
      } else if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
        setScreenError('Server is temporarily busy. Please wait a few seconds and try again.')
      } else {
        setScreenError(msg)
      }
    } finally {
      if (runId === screenRunIdRef.current) {
        setScreening(false)
        setTimeout(() => {
          if (runId === screenRunIdRef.current) setScreenProgress('')
        }, 2500)
      }
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
      const rawText = await res.text()
      let data: { content?: string; error?: string } = {}
      if (rawText.trim()) {
        try { data = JSON.parse(rawText) } catch { setComposeError('Invalid response from server.'); return }
      }
      if (!res.ok) { setComposeError(data.error ?? 'Generation failed'); return }
      const content = (data.content ?? '').trim()
      if (!content) { setComposeError('AI returned empty content — try again.'); return }
      setComposeOutput(content)
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
    setGenPostMode('existing')
    setGenPostJob(job)
    setGenPostOpen(true)
    const saved = job.post_contents
    const allKeys = JOB_POST_PLATFORMS as unknown as string[]
    const posts = saved
      ? Object.fromEntries(
          allKeys
            .filter(k => saved[k])
            .map(k => [k, saved[k]])
        )
      : {}
    setGeneratedPosts(posts)
    const firstKey = Object.keys(posts)[0]
    setGenPostTab(firstKey || 'linkedin')
    setGenCustomPrompt('')
    setGenPostError('')
    setQuickJdText('')
    setQuickTitle('')
  }

  const openGenPostModal = (mode: 'existing' | 'quick' = 'existing') => {
    setGenPostMode(mode)
    setGenPostOpen(true)
    if (mode === 'quick') {
      setGenPostJob(null)
      setGeneratedPosts({})
      setGenPostTab('linkedin')
      setGenCustomPrompt('')
      setGenPostError('')
    }
  }

  const closeGenPostModal = () => {
    setGenPostOpen(false)
    setGenPostJob(null)
    setActiveTab('jobs')
    loadData()
  }

  const generateJobPosts = async (job: Job, platforms = genPostPlatforms, force = true) => {
    setGeneratingPosts(true); setGenPostError(''); if (force) setGeneratedPosts({})
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
          raw_jd_text: (job as Job & { raw_jd_text?: string }).raw_jd_text,
          custom_prompt: genCustomPrompt,
          platforms,
          force,
        }),
      })
      const raw = await res.text()
      let data: { posts?: Record<string, string>; error?: string } = {}
      try { data = raw.trim() ? JSON.parse(raw) : {} } catch {
        setGenPostError('Invalid response from server. Please try again.')
        return
      }
      if (res.status === 403) {
        setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Post Generation' })
        return
      }
      if (!res.ok) { setGenPostError(data.error ?? 'Failed to generate posts'); return }
      const posts = data.posts ?? {}
      if (!Object.keys(posts).length) {
        setGenPostError('AI returned empty posts — try again with a clearer JD.')
        return
      }
      setGeneratedPosts(posts)
      const firstKey = Object.keys(posts)[0]
      if (firstKey) setGenPostTab(firstKey)
      await loadData()
      setWorkspaceBanner('Social posts generated and saved for this job.')
    } catch (e) {
      setGenPostError(String(e))
    } finally {
      setGeneratingPosts(false)
    }
  }

  const generateQuickPosts = async (platforms = genPostPlatforms, force = true) => {
    const jd = quickJdText.trim()
    if (!jd) { setGenPostError('Paste or upload a job description first.'); return }
    const title = quickTitle.trim() || jd.split('\n').find(l => l.trim())?.slice(0, 80) || 'Untitled Role'
    setGeneratingPosts(true); setGenPostError(''); if (force) setGeneratedPosts({})
    try {
      const res = await fetch('/api/jobs/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          company: quickCompany || undefined,
          location: quickLocation || undefined,
          description: jd,
          raw_jd_text: jd,
          custom_prompt: genCustomPrompt,
          platforms,
          force,
        }),
      })
      const raw = await res.text()
      let data: { posts?: Record<string, string>; error?: string } = {}
      try { data = raw.trim() ? JSON.parse(raw) : {} } catch {
        setGenPostError('Invalid response from server. Please try again.')
        return
      }
      if (res.status === 403) {
        setUpgradePrompt({ show: true, message: data.error || 'You have reached your plan limit.', feature: 'Job Post Generation' })
        return
      }
      if (!res.ok) { setGenPostError(data.error ?? 'Failed to generate posts'); return }
      const posts = data.posts ?? {}
      if (!Object.keys(posts).length) {
        setGenPostError('AI returned empty posts — try again with a clearer JD.')
        return
      }
      setGeneratedPosts(posts)
      setQuickTitle(title)
      const firstKey = Object.keys(posts)[0]
      if (firstKey) setGenPostTab(firstKey)
      setWorkspaceBanner('Channel posts generated (not saved as a job). Use Save as Job to persist.')
    } catch (e) {
      setGenPostError(String(e))
    } finally {
      setGeneratingPosts(false)
    }
  }

  const saveQuickAsJob = async () => {
    const jd = quickJdText.trim()
    const title = quickTitle.trim() || 'Untitled Role'
    if (!jd) { setGenPostError('JD text required to save as job.'); return }
    setGeneratingPosts(true); setGenPostError('')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          company: quickCompany || undefined,
          location: quickLocation || undefined,
          description: jd,
          raw_jd_text: jd,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGenPostError(data.error ?? 'Failed to save job'); return }
      const job = data.job as Job
      await loadData()
      if (job) {
        setGenPostJob(job)
        setGenPostMode('existing')
      }
      setWorkspaceBanner(`Saved as job: ${title}. Open Generate posts on the job to attach channels permanently.`)
    } catch (e) {
      setGenPostError(String(e))
    } finally {
      setGeneratingPosts(false)
    }
  }

  useEffect(() => {
    if (!autoGeneratePosts || !genPostJob) return
    setAutoGeneratePosts(false)
    void generateJobPosts(genPostJob, genPostPlatforms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGeneratePosts, genPostJob])

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
      <div className="min-h-dvh bg-slate-100 flex items-center justify-center overflow-x-clip">
        <AppSplash />
      </div>
    )
  }
  if (!session) return null

  const user = session.user
  const sessionWithRole = session as { user: { role?: string; email?: string; name?: string; image?: string } }
  const isOwner = sessionWithRole.user?.role === 'owner' || user?.email === process.env.NEXT_PUBLIC_OWNER_EMAIL
  const isTenantAdminOrOwner = tenantRole === 'owner' || tenantRole === 'admin'
  const canSeeAnalytics = isTenantAdminOrOwner || Boolean(tenantPermissions?.analytics?.tenant)
  const canSeeReports = isTenantAdminOrOwner
  const canSeeGovernance = isTenantAdminOrOwner
  const canSeeClients = isTenantAdminOrOwner || tenantRole === 'recruiter'
  const canSeeRecruiters = isTenantAdminOrOwner // Owner / Tenant Admin (+ manager when role exists)

  const sidebarNavItems: Array<{ tab: DashboardTab; icon: typeof TrendingUp; label: string; badge: string | null; section: 'recruitment' | 'ai' | 'ops' }> = [
    { tab: 'workspace', icon: TrendingUp, label: 'Dashboard', badge: agentPendingCount > 0 ? String(agentPendingCount) : null, section: 'recruitment' },
    { tab: 'jobs', icon: Briefcase, label: 'Jobs', badge: null, section: 'recruitment' },
    { tab: 'candidates', icon: Users, label: 'Candidates', badge: null, section: 'recruitment' },
    ...(canSeeClients ? [{ tab: 'clients' as const, icon: Building2, label: 'Clients', badge: null, section: 'recruitment' as const }] : []),
    { tab: 'talent' as const, icon: Search, label: 'Internal Talent Pool', badge: null, section: 'recruitment' as const },
    { tab: 'submissions', icon: Send, label: 'Submissions', badge: null, section: 'recruitment' },
    { tab: 'interviews', icon: Calendar, label: 'Interviews', badge: null, section: 'recruitment' },
    { tab: 'followups', icon: Clock, label: 'Follow-ups', badge: null, section: 'recruitment' },
    { tab: 'selected', icon: Award, label: 'Offer & Onboarding', badge: null, section: 'recruitment' },
    ...(canSeeRecruiters ? [{ tab: 'recruiters' as const, icon: Users, label: 'Recruiters', badge: null, section: 'recruitment' as const }] : []),
    { tab: 'documents', icon: FileText, label: 'Documents', badge: null, section: 'recruitment' },
    ...(canSeeReports ? [{ tab: 'reports' as const, icon: Download, label: 'Reports', badge: null, section: 'recruitment' as const }] : []),
    { tab: 'performance', icon: Target, label: 'My Performance', badge: null, section: 'recruitment' },
    /* AI section rendered as expandable shortcuts below — no single-item entry here */
    { tab: 'comms', icon: Mail, label: 'Communications', badge: null, section: 'ops' },
    ...(canSeeReports ? [{ tab: 'hrconfig' as const, icon: Shield, label: 'HRMS', badge: null, section: 'ops' as const }] : []),
    { tab: 'ess', icon: Building2, label: 'ESS', badge: null, section: 'ops' },
    ...(canSeeGovernance ? [{ tab: 'governance' as const, icon: Shield, label: 'Governance', badge: null, section: 'ops' as const }] : []),
    { tab: 'settings', icon: Settings, label: 'Settings', badge: null, section: 'ops' },
  ]

  const totalCandidates = Object.values(stageCounts).reduce((a, b) => a + b, 0)
  const hiredCount = stageCounts['hired'] ?? 0
  const interviewCount = stageCounts['interview'] ?? 0

  const filteredJobs = jobs.filter(j => {
    const roleQ = filterJobRole.toLowerCase()
    return (
      (!filterJobStatus || j.status === filterJobStatus) &&
      (!filterJobType || j.type === filterJobType) &&
      (!filterJobRole || j.title?.toLowerCase().includes(roleQ) || (j.short_id ?? '').toLowerCase().includes(roleQ)) &&
      (!filterJobCompany || (j.company ?? '').toLowerCase().includes(filterJobCompany.toLowerCase()))
    )
  })

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
    <div className="min-h-dvh dashboard-root bg-[#FCFCFA] overflow-x-clip">
      <div className="flex h-dvh overflow-hidden">

        {/* Mobile nav backdrop */}
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* ── Sidebar — dark navy + primary blue active (sticky on desktop) ─ */}
        <aside className={`w-56 flex-shrink-0 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-md dash-sidebar z-50
          fixed lg:sticky lg:top-0 h-dvh inset-y-0 left-0 transform transition-transform duration-200
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandMark size={32} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-white leading-tight tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>SRP SmartRecruit</p>
                <p className="text-[10px] leading-tight mt-0.5 font-bold text-[#F97316]">Recruitment OS</p>
              </div>
            </div>
            <button type="button" className="lg:hidden p-1.5 text-slate-300" onClick={() => setMobileNavOpen(false)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {profileData?.subscription && profileData.subscription.plan !== 'free' && (
            <div className="mx-2.5 mt-2.5 px-2.5 py-1.5 rounded-lg flex items-center gap-2 bg-indigo-500/15 border border-indigo-400/30">
              <Crown className="w-3.5 h-3.5 text-indigo-200 flex-shrink-0" />
              <span className="text-[11px] font-bold capitalize text-indigo-100">{profileData.subscription.plan} Plan</span>
            </div>
          )}
          {profileData?.subscription?.plan === 'free' && (
            <button onClick={() => setUpgradePrompt({ show: true, message: 'Unlock unlimited AI screenings, job posts, and all premium features.', feature: 'Pro Plan' })}
              className="mx-2.5 mt-2.5 px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors border border-[#F97316]/50 bg-[#F97316]/15 hover:bg-[#F97316]/25 text-left group">
              <Zap className="w-3.5 h-3.5 text-[#F97316] group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-bold text-[#fed7aa]">Upgrade to Pro</span>
            </button>
          )}

          <nav className="flex-1 px-2 py-2.5 space-y-0.5 overflow-y-auto min-h-0" aria-label="Workspace">
            {(['recruitment', 'ai', 'ops'] as const).map(section => {
              if (section === 'ai') {
                return (
                  <div key="ai" className="mt-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setAiNavExpanded(v => !v)}
                      aria-expanded={aiNavExpanded}
                      aria-controls="ai-tools-nav"
                      className="w-full flex items-center gap-1 px-2.5 mb-1.5 rounded-md text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <span className="flex-1 text-left text-[9px] font-extrabold uppercase tracking-widest">AI Tools</span>
                      {aiNavExpanded
                        ? <ChevronUp className="w-3 h-3 flex-shrink-0" aria-hidden />
                        : <ChevronDown className="w-3 h-3 flex-shrink-0" aria-hidden />}
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
                              className="w-full pl-7 pr-2 py-1.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                            />
                          </div>
                        </div>
                        {filteredAiShortcuts.map(s => {
                          const active = isAiShortcutActive(s)
                          const Icon = s.icon
                          return (
                            <button
                              key={s.id}
                              type="button"
                              title={s.tooltip}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => openAiShortcut(s)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                                active
                                  ? 'bg-[var(--sidebar-active)] text-white shadow-sm'
                                  : 'text-slate-300 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} aria-hidden />
                              <span className="flex-1 text-left truncate">{s.label}</span>
                              {s.badge && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                  active ? 'bg-white/25 text-white' : 'bg-teal-500/20 text-teal-200'
                                }`}>{s.badge}</span>
                              )}
                            </button>
                          )
                        })}
                        {filteredAiShortcuts.length === 0 && (
                          <p className="px-2.5 py-2 text-[11px] text-slate-500">No matching tools</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              const items = sidebarNavItems.filter(i => i.section === section)
              if (items.length === 0) return null
              const sectionLabel = section === 'recruitment' ? 'Recruitment' : 'Operations'
              return (
                <div key={section} className={section === 'recruitment' ? '' : 'mt-3 pt-2 border-t border-white/10'}>
                  <p className="px-2.5 mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">{sectionLabel}</p>
                  {items.map(({ tab, icon: Icon, label, badge }) => (
                    <button key={`${section}-${tab}-${label}`} type="button" onClick={() => goTab(tab)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                        activeTab === tab
                          ? 'bg-[var(--sidebar-active)] text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`} />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {badge && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          activeTab === tab ? 'bg-white/25 text-white' : 'bg-teal-500/20 text-teal-200'
                        }`}>{badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              )
            })}

            {isOwner && (
              <button onClick={() => router.push('/owner')}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-bold text-amber-200 hover:bg-amber-500/15 transition-all mt-4 border border-amber-400/30">
                <Crown className="w-3.5 h-3.5 flex-shrink-0" /> Owner Panel
              </button>
            )}
          </nav>

          <div className="px-2 py-3 border-t border-[var(--sidebar-border)] mt-auto">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              {user?.image
                ? /* eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL from session */
                  <img src={user.image} alt="" className="w-8 h-8 rounded-full ring-2 ring-indigo-400/40 object-cover" />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]">{user?.name?.[0] ?? '?'}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{user?.name}</p>
                <p className="text-[10px] truncate text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-1.5 w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-bold text-slate-200 hover:text-white hover:bg-indigo-500/20 border border-white/15 hover:border-indigo-400/40 transition-all">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-clip dashboard-main min-h-0 min-w-0 bg-[var(--dash-bg)]">
          {/* Subscription expiry alert banner */}
          {subAlert && !subAlertDismissed && (
            <div className={`border-b ${
              subAlert.level === 'expired' ? 'bg-red-50 border-red-200' :
              subAlert.level === 'urgent' ? 'bg-amber-50 border-amber-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="dash-page-shell py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {subAlert.level === 'expired' ? <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" /> :
                   subAlert.level === 'urgent' ? <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" /> :
                   <Clock className="w-4 h-4 text-yellow-700 flex-shrink-0" />}
                  <p className={`text-sm font-medium ${
                    subAlert.level === 'expired' ? 'text-red-900' :
                    subAlert.level === 'urgent' ? 'text-amber-900' : 'text-yellow-900'
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
                    <button onClick={() => setSubAlertDismissed(true)} className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-200/80">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Free plan usage warning banner — thresholds scale with PLAN_LIMITS */}
          {profileData?.subscription?.plan === 'free' && profileData.usage && (
            (profileData.usage.active_jobs >= Math.max(1, PLAN_LIMITS.free.job_posts - 1) ||
              profileData.usage.screens_this_month >= Math.max(1, PLAN_LIMITS.free.ai_screens_per_month - 5)) && !subAlertDismissed
          ) && (
            <div className="border-b border-amber-200 bg-amber-50/90">
              <div className="dash-page-shell py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-950">
                    {profileData.usage.active_jobs >= Math.max(1, PLAN_LIMITS.free.job_posts - 1)
                      ? `You've used ${profileData.usage.active_jobs} of ${PLAN_LIMITS.free.job_posts} free job posts.`
                      : `You've used ${profileData.usage.screens_this_month} of ${PLAN_LIMITS.free.ai_screens_per_month} free AI screens this month.`}
                    {' '}Upgrade to Pro for unlimited access.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setUpgradePrompt({ show: true, message: 'Unlock unlimited features with a Pro plan.', feature: 'Pro Plan' })}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm">
                    <Zap className="w-3 h-3" /> Upgrade
                  </button>
                  <button onClick={() => setSubAlertDismissed(true)} className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-200/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact action bar — header KPI boxes removed per product request */}
          <div className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-sm shadow-slate-900/5 safe-top">
            <div className="dash-page-shell py-2 flex items-center justify-end gap-1.5 flex-wrap min-w-0">
              <button
                type="button"
                className="lg:hidden inline-flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 bg-white text-slate-700"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <Layers className="w-4 h-4" />
              </button>
              <GlobalSearchPalette />
              <InstallAppButton compact />
              <a
                href="/m"
                className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-[11px] font-extrabold border border-[#166534]/25 text-[#166534] bg-[#ecfdf3] hover:bg-[#d1fae5]"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Mobile</span>
              </a>
              <NotificationBell />
              <button onClick={() => setShowNewCandidate(true)}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] px-2.5 sm:px-3 rounded-lg bg-white hover:bg-[#ecfdf3] border-2 border-[#166534] text-[12px] text-[#166534] font-bold transition-colors shadow-sm hover:shadow-md">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Add Candidate</span>
              </button>
              <button onClick={() => setShowNewJob(true)}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] px-2.5 sm:px-3 rounded-lg text-[12px] font-bold text-white transition-colors bg-[#F97316] hover:bg-[#ea580c] shadow-sm">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">New Job</span>
              </button>
            </div>
          </div>

          {workspaceBanner && (
            <div className="border-b border-emerald-200 bg-emerald-50/95">
              <div className="dash-page-shell py-2 flex items-center gap-2 text-[13px] text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
                <span>{workspaceBanner}</span>
              </div>
            </div>
          )}

          {profileData?.subscription?.retention?.banner && (
            <div className="border-b border-amber-200 bg-amber-50/95">
              <div className="dash-page-shell py-2.5 flex items-start gap-2 text-[13px] text-amber-950">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <span>{profileData.subscription.retention.banner}</span>
              </div>
            </div>
          )}

          <div className={`dash-page-shell py-5 lg:py-6 pb-10 dash-tab-fade${isWideTab ? ' dash-page-shell--wide' : ''}`}>

            {/* ── MY WORKSPACE ─────────────────────────────────────────────── */}
            {activeTab === 'workspace' && (
              <WorkspaceTab
                onNavigate={(tab) => setActiveTab(tab as DashboardTab)}
                userName={user?.name}
                role={tenantRole}
                isManager={isTenantAdminOrOwner || tenantRole === 'manager' || tenantRole === 'recruitment_head'}
              />
            )}

            {/* Pipeline Kanban removed — any 'pipeline' tab redirects to Candidates */}

            {/* ── CANDIDATES ───────────────────────────────────────────────── */}
            {activeTab === 'candidates' && (
              <div>
                <div className="dash-section-head">
                  <div className="flex items-start gap-4">
                    <div className="dash-section-icon">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>Candidates</h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {filterStage
                          ? (() => {
                              const st = PIPELINE_STAGES.find(s => s.key === filterStage)?.label ?? filterStage
                              return <><span className="text-indigo-600 font-semibold">{candidates.length}</span> in <span className="font-semibold text-slate-700">{st}</span></>
                            })()
                          : filterSkill ? <><span className="text-indigo-600 font-semibold">{candidates.length}</span> with &quot;{filterSkill}&quot;</> : `${candidates.length} total`}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1.5 max-w-xl leading-relaxed">
                        Each row shows <span className="font-semibold text-slate-600">RES-</span> and linked <span className="font-semibold text-slate-600">JOB-</span> IDs. Duplicate email warnings are scoped to this workspace only.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setActiveTab('import')}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm">
                      <Upload className="w-4 h-4" /> Import
                    </button>
                    <button onClick={() => setShowNewCandidate(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-[#166534] hover:bg-[#14532d] shadow-md shadow-green-900/15">
                      <Plus className="w-4 h-4" /> Add Candidate
                    </button>
                  </div>
                </div>

                {/* ── Filter bar ── */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/5 mb-5 ring-1 ring-slate-950/[0.02]">
                  <div className="filter-bar-label mb-3">
                    <Filter className="w-3.5 h-3.5 text-[#166534]" aria-hidden />
                    Filters
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px]">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input value={searchQ} onChange={e => {
                          const v = e.target.value
                          setSearchQ(v)
                          // Smart ID routing: RES-xxxxx → candidates tab, JOB-xxxxx → jobs tab
                          if (/^RES-\d+/i.test(v.trim())) { setActiveTab('candidates') }
                          else if (/^JOB-\d+/i.test(v.trim())) { setActiveTab('jobs') }
                        }}
                        placeholder="Search name, email, phone, NRIC, RES-ID, skills…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                    </div>

                    {/* Skill */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Skill</span>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#166534]" />
                        <input value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
                          placeholder="e.g. React"
                          list="skill-suggestions"
                          className="pl-7 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-28" />
                        <datalist id="skill-suggestions">
                          {topSkills.map(({ skill }) => <option key={skill} value={skill} />)}
                        </datalist>
                      </div>
                    </div>

                    {/* Stage */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Stage</span>
                      <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500">
                        <option value="">All</option>
                        {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>

                    {/* Match */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Match</span>
                      <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500">
                        <option value="">All</option>
                        <option value="best">Best</option>
                        <option value="good">Good</option>
                        <option value="partial">Partial</option>
                        <option value="poor">Low</option>
                      </select>
                    </div>

                    {/* Job */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Job</span>
                      <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 max-w-[150px]">
                        <option value="">All Jobs</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                      </select>
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Date</span>
                      <select value={filterDate} onChange={e => { setFilterDate(e.target.value); setCandPage(1) }}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500">
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                      </select>
                    </div>

                    {/* Hire type */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Hire Type</span>
                      <select value={filterHireType} onChange={e => { setFilterHireType(e.target.value); setCandPage(1) }}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500">
                        <option value="">All</option>
                        {HIRE_TYPES.map(h => <option key={h} value={h}>{HIRE_TYPE_LABELS[h]}</option>)}
                      </select>
                    </div>

                    {/* Lifecycle */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Status</span>
                      <select value={filterLifecycle} onChange={e => { setFilterLifecycle(e.target.value); setCandPage(1) }}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 max-w-[140px]">
                        <option value="">All</option>
                        {LIFECYCLE_STATUSES.map(s => <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>)}
                      </select>
                    </div>

                    {/* Recruiter */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Recruiter</span>
                      <select value={filterRecruiter} onChange={e => { setFilterRecruiter(e.target.value); setCandPage(1) }}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 max-w-[140px]">
                        <option value="">All</option>
                        {teamMembers.filter(m => m.invite_accepted).map(m => (
                          <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                        ))}
                      </select>
                    </div>

                    {/* Client */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Client</span>
                      <input value={filterClient} onChange={e => { setFilterClient(e.target.value); setCandPage(1) }}
                        placeholder="Client name"
                        className="px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-28" />
                    </div>

                    {/* Visa */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Visa</span>
                      <select value={filterVisa} onChange={e => { setFilterVisa(e.target.value); setCandPage(1) }}
                        className="appearance-none pl-2 pr-6 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 max-w-[130px]">
                        <option value="">All</option>
                        {VISA_TYPES.map(v => <option key={v} value={v}>{VISA_TYPE_LABELS[v]}</option>)}
                      </select>
                    </div>

                    {/* Location */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Location</span>
                      <input value={filterLocation} onChange={e => { setFilterLocation(e.target.value); setCandPage(1) }}
                        placeholder="City"
                        className="px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-24" />
                    </div>

                    {/* Source */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide px-0.5">Source</span>
                      <input value={filterSource} onChange={e => { setFilterSource(e.target.value); setCandPage(1) }}
                        placeholder="Source"
                        className="px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-24" />
                    </div>

                    {(searchQ || filterStage || filterMatch || filterJob || filterSkill || filterDate || selectedJob || filterHireType || filterSource || filterRecruiter || filterClient || filterLifecycle || filterVisa || filterLocation) && (
                      <button onClick={() => {
                        setSearchQ(''); setFilterStage(''); setFilterMatch(''); setFilterJob(''); setFilterSkill(''); setFilterDate(''); setSelectedJob('')
                        setFilterHireType(''); setFilterSource(''); setFilterRecruiter(''); setFilterClient(''); setFilterLifecycle(''); setFilterVisa(''); setFilterLocation(''); setCandPage(1)
                      }}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 px-2.5 py-1.5 rounded-lg bg-white hover:bg-red-50 hover:border-red-200 transition-colors">
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                    <CandidateColumnPicker visible={visibleCandCols} onChange={setVisibleCandCols} />
                    <button
                      onClick={async () => {
                        setExportingTracker(true)
                        try {
                          const params = new URLSearchParams()
                          if (searchQ) params.set('q', searchQ)
                          if (filterStage) params.set('stage', filterStage)
                          if (filterMatch) params.set('match', filterMatch)
                          if (filterJob || selectedJob) params.set('job_id', filterJob || selectedJob)
                          if (filterSkill) params.set('skill', filterSkill)
                          if (filterDate) params.set('date_range', filterDate)
                          const res = await fetch(`/api/candidates/export?${params}`)
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}))
                            alert(err.error ?? 'Export failed')
                            return
                          }
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `smartrecruit-tracker-${new Date().toISOString().slice(0, 10)}.csv`
                          document.body.appendChild(a)
                          a.click()
                          a.remove()
                          URL.revokeObjectURL(url)
                        } finally {
                          setExportingTracker(false)
                        }
                      }}
                      disabled={exportingTracker}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      title="Download filtered candidates for this workspace only (Excel-compatible CSV)"
                    >
                      <Download className="w-3.5 h-3.5" /> {exportingTracker ? 'Exporting…' : 'Export Excel'}
                    </button>
                    <button onClick={loadData} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>
                </div>

                {duplicateEmailKeys.size > 0 && (
                  <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-900/5 flex flex-wrap items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-900">Same email appears on multiple records in this workspace</p>
                      <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                        Each row shows who added it and when. Your team chooses the canonical record — data never merges across tenants.
                      </p>
                    </div>
                  </div>
                )}

                <CandidateBulkBar
                  selectedIds={bulkSelectedIds}
                  teamMembers={teamMembers.filter(m => m.invite_accepted)}
                  onClear={() => setBulkSelectedIds([])}
                  onDone={() => { setBulkSelectedIds([]); loadData() }}
                  onExportSelected={async (ids) => {
                    setExportingTracker(true)
                    try {
                      const params = new URLSearchParams()
                      params.set('ids', ids.join(','))
                      const res = await fetch(`/api/candidates/export?${params}`)
                      if (!res.ok) { alert('Export failed'); return }
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `smartrecruit-selected-${new Date().toISOString().slice(0, 10)}.csv`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } finally {
                      setExportingTracker(false)
                    }
                  }}
                />

                {loading ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-lg bg-slate-100" />
                    ))}
                  </div>
                ) : (
                  <>
                  <ScrollableTable stickyX>
                    <table className="ent-table">
                      <thead>
                        <tr>
                          <th className="w-8">
                            <input
                              type="checkbox"
                              checked={candidates.length > 0 && bulkSelectedIds.length === candidates.length}
                              onChange={e => {
                                if (e.target.checked) setBulkSelectedIds(candidates.map(c => c.id))
                                else setBulkSelectedIds([])
                              }}
                              onClick={e => e.stopPropagation()}
                              aria-label="Select all on page"
                            />
                          </th>
                          {showCandCol('id') && <th className="col-id">ID</th>}
                          {showCandCol('name') && <th className="col-name">Name</th>}
                          {showCandCol('phone') && <th className="col-phone">Phone</th>}
                          {showCandCol('email') && <th className="col-email">Email</th>}
                          {showCandCol('nric') && <th className="col-id">NRIC</th>}
                          {showCandCol('client') && <th className="col-client">Client</th>}
                          {showCandCol('hire_type') && <th className="col-hire">Hire Type</th>}
                          {showCandCol('applying_for') && <th className="col-role">Applying For</th>}
                          {showCandCol('experience') && <th className="col-num">Experience</th>}
                          {showCandCol('source') && <th className="col-status">Source</th>}
                          {showCandCol('ai_score') && <th className="col-status">AI Score</th>}
                          {showCandCol('screened_job') && <th className="col-role">Screened Job</th>}
                          {showCandCol('location') && <th className="col-person">Location</th>}
                          {showCandCol('current_role') && <th>Current Role</th>}
                          {showCandCol('parsed') && <th>Parsed</th>}
                          {showCandCol('status') && <th>Status</th>}
                          {showCandCol('uploaded') && <th>Uploaded</th>}
                          {showCandCol('recruiter') && <th>Recruiter</th>}
                          {showCandCol('cv') && <th>CV</th>}
                          {showCandCol('actions') && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.length === 0 ? (
                          <tr><td colSpan={candColSpan} className="px-4 py-12 text-center text-gray-400">
                            <p className="font-medium text-slate-500">No candidates found</p>
                            <p className="text-xs text-slate-400 mt-1">Try clearing filters or add a new candidate.</p>
                          </td></tr>
                        ) : candidates.map((c, i) => {
                          const p = c.candidate_profile ?? {}
                          const nric = p.nric || (String(p.id_document_type ?? '').toLowerCase().includes('nric') ? p.id_document_reference : null)
                          const parsed = !!(c.raw_text && c.raw_text.trim().length > 20)
                          return (
                          <tr key={c.id} onClick={() => router.push(`/dashboard/candidates/${c.id}`)} className={`cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-indigo-50/40`}>
                            <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={bulkSelectedIds.includes(c.id)}
                                onChange={e => {
                                  if (e.target.checked) setBulkSelectedIds(prev => [...prev, c.id])
                                  else setBulkSelectedIds(prev => prev.filter(x => x !== c.id))
                                }}
                                aria-label={`Select ${c.candidate_name}`}
                              />
                            </td>
                            {showCandCol('id') && <td className="px-3 py-2.5"><ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} /></td>}
                            {showCandCol('name') && (
                            <td className="px-3 py-2.5 min-w-[140px] max-w-[180px]">
                              <p className="font-semibold text-[13px] text-gray-900 truncate">{cleanCandidateName(c.candidate_name) || c.candidate_name}</p>
                              {!nric && !p.passport_number && !p.id_document_reference && (
                                <span className="inline-flex mt-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">ID missing</span>
                              )}
                            </td>
                            )}
                            {showCandCol('phone') && <td className="px-3 py-2.5 text-[12px] text-slate-600 whitespace-nowrap">{formatPhoneInternational(c.candidate_phone) || c.candidate_phone || '—'}</td>}
                            {showCandCol('email') && <td className="px-3 py-2.5 text-[12px] text-slate-700 max-w-[160px] truncate">{c.candidate_email || '—'}</td>}
                            {showCandCol('nric') && <td className="px-3 py-2.5 text-[12px] font-mono text-slate-700 whitespace-nowrap">{nric || '—'}</td>}
                            {showCandCol('client') && <td className="px-3 py-2.5 text-[12px] text-slate-600 max-w-[120px] truncate">{p.client_name || c.job_posts?.company || '—'}</td>}
                            {showCandCol('hire_type') && <td className="px-3 py-2.5 text-[12px] capitalize text-slate-600">{p.hire_type ? (HIRE_TYPE_LABELS[p.hire_type as keyof typeof HIRE_TYPE_LABELS] || p.hire_type) : '—'}</td>}
                            {showCandCol('applying_for') && <td className="px-3 py-2.5 text-[12px] text-slate-600 max-w-[130px] truncate">{p.applying_for || c.job_posts?.title || '—'}</td>}
                            {showCandCol('experience') && <td className="px-3 py-2.5 text-[12px] text-slate-600 whitespace-nowrap">{p.total_experience || '—'}</td>}
                            {showCandCol('source') && (
                            <td className="px-3 py-2.5">
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 whitespace-nowrap">{p.source_channel || c.source_type || 'Manual'}</span>
                            </td>
                            )}
                            {showCandCol('ai_score') && <td className="px-3 py-2.5 whitespace-nowrap"><MatchBadge category={c.match_category} score={c.ai_score} variant="light" /></td>}
                            {showCandCol('screened_job') && (
                            <td className="min-w-[110px] max-w-[150px]" onClick={e => e.stopPropagation()}>
                              {c.job_posts ? (
                                <button onClick={() => { if (c.job_posts?.id) router.push(`/dashboard/jobs/${c.job_posts.id}`) }}
                                  className="text-left text-[12px] font-medium text-indigo-700 hover:underline truncate block max-w-[140px]">{c.job_posts.title}</button>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            )}
                            {showCandCol('location') && <td className="px-3 py-2.5 text-[12px] text-slate-600 whitespace-nowrap">{p.current_location || '—'}</td>}
                            {showCandCol('current_role') && <td className="px-3 py-2.5 text-[12px] text-slate-600 max-w-[120px] truncate">{p.current_role || p.current_title || '—'}</td>}
                            {showCandCol('parsed') && (
                            <td className="px-3 py-2.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${parsed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {parsed ? 'Yes' : 'No'}
                              </span>
                            </td>
                            )}
                            {showCandCol('status') && (
                            <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <select
                                value={c.pipeline_stage}
                                onChange={e => moveStage(c.id, e.target.value)}
                                className={`text-xs font-medium px-2 py-0.5 rounded-full border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${STAGE_LIGHT[c.pipeline_stage]?.bg ?? 'bg-slate-100'} ${STAGE_LIGHT[c.pipeline_stage]?.text ?? 'text-slate-600'} ${STAGE_LIGHT[c.pipeline_stage]?.border ?? 'border-slate-200'}`}
                                title={formatLifecycle(p.lifecycle_status)}>
                                {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                              {p.lifecycle_status && (
                                <p className="text-[10px] text-slate-400 mt-0.5 max-w-[100px] truncate">{formatLifecycle(p.lifecycle_status)}</p>
                              )}
                            </td>
                            )}
                            {showCandCol('uploaded') && (
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <p className="text-xs text-gray-500">{fmtDate(c.created_at)}</p>
                            </td>
                            )}
                            {showCandCol('recruiter') && <td className="px-3 py-2.5 text-[11px] text-gray-500 truncate max-w-[110px]" title={formatUploader(c.uploaded_by)}>{formatUploader(c.uploaded_by)}</td>}
                            {showCandCol('cv') && (
                            <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              {c.resume_original_path ? (
                                <div className="flex gap-1">
                                  <a href={`/api/candidates/${c.id}/resume-file?inline=1`} target="_blank" rel="noreferrer"
                                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100">Preview</a>
                                  <a href={`/api/candidates/${c.id}/resume-file`}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100">DL</a>
                                </div>
                              ) : c.raw_text ? (
                                <span className="text-[10px] text-slate-400 font-medium" title="Parsed text only — no original file">Text only</span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            )}
                            {showCandCol('actions') && (
                            <td className="px-3 py-2.5 whitespace-nowrap relative" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setSubmissionCandidate(c)}
                                  className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100">Details</button>
                                <button type="button" onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">View</button>
                                <button type="button" onClick={() => setEditCandidate(c)}
                                  className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">Edit</button>
                                <button type="button" onClick={() => setActionsMenuId(actionsMenuId === c.id ? null : c.id)}
                                  className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="More actions">
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {actionsMenuId === c.id && (
                                <div className="absolute right-2 top-9 z-20 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs">
                                  <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { router.push(`/dashboard/candidates/${c.id}`); setActionsMenuId(null) }}>View candidate</button>
                                  <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setEditCandidate(c); setActionsMenuId(null) }}>Edit candidate</button>
                                  <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setSubmissionCandidate(c); setActionsMenuId(null) }}>Submission details</button>
                                  <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setActiveTab('screen'); setScreenMode('existing'); setSelectedCandIds([c.id]); setActionsMenuId(null) }}>AI analysis</button>
                                  {c.resume_original_path ? (
                                    <>
                                      <a className="block w-full text-left px-3 py-2 hover:bg-slate-50" href={`/api/candidates/${c.id}/resume-file?inline=1`} target="_blank" rel="noreferrer" onClick={() => setActionsMenuId(null)}>Resume preview</a>
                                      <a className="block w-full text-left px-3 py-2 hover:bg-slate-50" href={`/api/candidates/${c.id}/resume-file`} onClick={() => setActionsMenuId(null)}>Download resume</a>
                                    </>
                                  ) : (
                                    <span className="block w-full text-left px-3 py-2 text-slate-400 cursor-default">No resume file on record</span>
                                  )}
                                  <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 text-amber-700"
                                    onClick={async () => {
                                      setActionsMenuId(null)
                                      const life = 'hold'
                                      const res = await fetch(`/api/candidates/${c.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ candidate_profile: { ...(c.candidate_profile ?? {}), lifecycle_status: life }, pipeline_stage: 'sourced' }),
                                      })
                                      if (res.ok) {
                                        const data = await res.json()
                                        applyCandidatePatch(c.id, { candidate_profile: data.candidate?.candidate_profile ?? { ...(c.candidate_profile ?? {}), lifecycle_status: life }, pipeline_stage: 'sourced' })
                                      }
                                    }}>Archive / Hold</button>
                                  {tenantRole !== 'viewer' && (
                                    <DeleteActionButton
                                      compact
                                      resourceType="candidate"
                                      resourceId={c.id}
                                      resourceLabel={c.short_id || c.candidate_name || 'Candidate'}
                                      canDirectDelete={isTenantAdminOrOwner || Boolean(tenantPermissions?.candidates?.delete)}
                                      onDone={({ direct }) => {
                                        setActionsMenuId(null)
                                        if (direct) {
                                          setCandidates(prev => prev.filter(x => x.id !== c.id))
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                            </td>
                            )}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollableTable>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                    <span>{candTotal} candidate{candTotal !== 1 ? 's' : ''} · page {candPage} of {candTotalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={candPage <= 1} onClick={() => setCandPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Previous</button>
                      <button type="button" disabled={candPage >= candTotalPages} onClick={() => setCandPage(p => p + 1)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Next</button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            )}

            {/* ── AI SCREEN ────────────────────────────────────────────────── */}
            {activeTab === 'screen' && (
              <div>
              <button type="button" onClick={() => setActiveTab('coach')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← AI Assistant</button>
              
              <div>
                <div className="dash-section-head">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="dash-section-icon">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>AI Screening</h1>
                      <p className="text-sm text-slate-500 mt-0.5">Score and rank candidates against your job description</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {(['single', 'bulk', 'existing'] as const).map(m => (
                      <button key={m} onClick={() => {
                        setScreenMode(m)
                        if (!screening) {
                          setScreenResults([])
                          setSelectedCandIds([])
                        }
                        setScreenSingleFile(null)
                        if (m !== 'bulk') setBulkTexts([])
                      }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${screenMode === m ? 'bg-[#166534] text-white border-transparent shadow-md shadow-indigo-900/20' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'}`}>
                        {m === 'single' ? 'Single CV' : m === 'bulk' ? 'Bulk CVs' : 'From Candidates'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {/* JD panel */}
                  <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Job Description</label>
                    <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={10}
                      placeholder="Paste the full job description here…"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 resize-none" />
                    <p className="text-xs font-semibold text-gray-600">Or upload JD file:</p>
                    <FileUploadZone label="Upload JD (PDF/DOC/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple={false}
                      onTexts={([t]) => setJdText(t.text)} disabled={screening} />
                  </div>

                  {/* Resume panel */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {screenMode === 'single' ? 'Candidate Resume' : screenMode === 'bulk' ? `Bulk Resumes (${bulkTexts.length} loaded)` : 'Select Candidates'}
                    </label>
                    {screenMode === 'single' ? (
                      <>
                        <textarea value={resumeText} onChange={e => { setResumeText(e.target.value); setScreenSingleFile(null) }} rows={10}
                          placeholder="Paste the candidate's resume text here…"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 resize-none" />
                        <p className="text-xs font-semibold text-gray-600">Or upload resume file:</p>
                        <FileUploadZone label="Upload Resume (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple={false}
                          onTexts={(ts) => {
                            if (ts.length > 1) {
                              setScreenMode('bulk')
                              setBulkTexts(ts)
                              setResumeText('')
                              setScreenSingleFile(null)
                              return
                            }
                            setResumeText(ts[0]?.text ?? '')
                            setScreenSingleFile(ts[0]?.file ?? null)
                          }} disabled={screening} />
                      </>
                    ) : screenMode === 'bulk' ? (
                      <FileUploadZone label="Upload multiple CVs (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple
                        onTexts={ts => setBulkTexts(ts)} disabled={screening} />
                    ) : (
                      /* ── From Candidates picker ── */
                      (() => {
                        const hasCvCands = candidates.filter(c => c.raw_text)
                        const filteredCands = hasCvCands.filter(c => {
                          const searchLower = existingCandSearch.toLowerCase()
                          if (!searchLower) return true
                          return (c.candidate_name?.toLowerCase().includes(searchLower) ||
                                  c.candidate_email?.toLowerCase().includes(searchLower) ||
                                  c.short_id?.toLowerCase().includes(searchLower))
                        }).filter(c => skipAlreadyScreened ? !c.ai_screening_data : true)
                        const alreadyScreenedCount = hasCvCands.filter(c => c.ai_screening_data).length
                        const allSelected = filteredCands.length > 0 && filteredCands.every(c => selectedCandIds.includes(c.id))
                        return (
                          <div className="space-y-2">
                            {/* Token savings info bar */}
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-semibold text-emerald-700">
                                  {alreadyScreenedCount} candidate{alreadyScreenedCount !== 1 ? 's' : ''} already screened — saved {alreadyScreenedCount} API call{alreadyScreenedCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={skipAlreadyScreened}
                                  onChange={e => setSkipAlreadyScreened(e.target.checked)}
                                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                                <span className="text-xs text-gray-600">Skip already screened</span>
                              </label>
                            </div>
                            {/* Search */}
                            <input value={existingCandSearch} onChange={e => setExistingCandSearch(e.target.value)}
                              placeholder="Search by name / email / ID…"
                              className="w-full px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
                            {/* Select all / count */}
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                                <input type="checkbox" checked={allSelected} onChange={e => {
                                  if (e.target.checked) setSelectedCandIds(prev => [...new Set([...prev, ...filteredCands.map(c => c.id)])])
                                  else setSelectedCandIds(prev => prev.filter(id => !filteredCands.find(c => c.id === id)))
                                }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                Select all ({filteredCands.length})
                              </label>
                              {selectedCandIds.length > 0 && (
                                <span className="text-xs font-semibold text-blue-600">{selectedCandIds.length} selected</span>
                              )}
                            </div>
                            {/* Candidate list */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto">
                              {filteredCands.length === 0 ? (
                                <p className="px-3 py-4 text-xs text-gray-400 text-center">
                                  {hasCvCands.length === 0 ? 'No candidates with stored CV text. Upload CVs through AI Screening first.' :
                                   skipAlreadyScreened ? 'All candidates have already been screened! Uncheck "Skip already screened" to re-screen.' :
                                   'No candidates match your search.'}
                                </p>
                              ) : filteredCands.map(c => {
                                const checked = selectedCandIds.includes(c.id)
                                return (
                                  <label key={c.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                                    <input type="checkbox" checked={checked}
                                      onChange={e => setSelectedCandIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{c.candidate_name || 'Unknown'}</p>
                                      <p className="text-xs text-gray-400 truncate">{c.candidate_email || c.short_id}</p>
                                    </div>
                                    {c.ai_score != null && (
                                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.ai_score >= 70 ? 'bg-emerald-100 text-emerald-700' : c.ai_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {c.ai_score}%
                                      </span>
                                    )}
                                    {c.ai_screening_data && !skipAlreadyScreened && (
                                      <span className="text-xs text-amber-600 font-medium">⚠ Re-screen</span>
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Select Job (loads full JD automatically)</label>
                      <select
                        value={screenJobId}
                        onChange={async e => {
                          const id = e.target.value
                          setScreenJobId(id)
                          if (!id) {
                            setScreenJobMeta(null)
                            return
                          }
                          setScreenJobMeta({ loading: true })
                          try {
                            const res = await fetch(`/api/jobs/${id}/screening-context`)
                            const data = await res.json()
                            if (!res.ok) {
                              setScreenError(data.error || 'Could not load job JD')
                              setScreenJobMeta(null)
                              return
                            }
                            setJdText(data.jd_text || '')
                            setScreenJobMeta({
                              title: data.title,
                              client: data.client,
                              loading: false,
                            })
                            setScreenError('')
                          } catch {
                            setScreenError('Failed to load job JD')
                            setScreenJobMeta(null)
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-gray-700 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15">
                        <option value="">— Select a job to auto-load JD —</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0,8)})</option>)}
                      </select>
                      {screenJobMeta?.loading && (
                        <p className="text-xs text-[#166534] mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading complete JD…</p>
                      )}
                      {screenJobId && screenJobMeta && !screenJobMeta.loading && (
                        <p className="text-xs text-emerald-700 mt-1 font-medium">
                          JD loaded from job{screenJobMeta.title ? `: ${screenJobMeta.title}` : ''}
                          {screenJobMeta.client ? ` · ${screenJobMeta.client}` : ''}. Manual paste is optional override only.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {screenError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {screenError}
                    {screenError.includes('OPENAI_API_KEY') && <span className="ml-1 text-slate-600">— contact your admin to configure OpenAI on the server</span>}
                  </div>
                )}

                {screening && screenProgress && (
                  <div className="mb-4 rounded-xl border border-[#F97316]/35 bg-[#fff7ed] px-4 py-3 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#F97316] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#9a3412]">AI Screening in progress</p>
                      <p className="text-xs text-[#c2410c] mt-0.5 truncate">{screenProgress}</p>
                    </div>
                  </div>
                )}

                <button onClick={runScreening}
                  disabled={screening || (!jdText && !screenJobId) || (screenMode === 'single' ? !resumeText : screenMode === 'bulk' ? bulkTexts.length === 0 : selectedCandIds.length === 0)}
                  className="mb-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] font-semibold text-sm text-white shadow-md shadow-orange-900/15 transition-colors disabled:opacity-50 disabled:pointer-events-none">
                  {screening ? <><Loader2 className="w-4 h-4 animate-spin" /> Screening…</> : <><Sparkles className="w-4 h-4" /> {screenMode === 'existing' ? `Screen ${selectedCandIds.length} Candidate${selectedCandIds.length !== 1 ? 's' : ''} (0 token waste)` : 'Run AI Screening'}</>}
                </button>

                {screenResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h2 className="text-sm font-semibold text-gray-700">
                        {screenResults.length} result{screenResults.length > 1 ? 's' : ''}
                        {screenResults.some(r => r.draft || (!r.db_id && !r.persisted))
                          ? ' — preview (Save to keep)'
                          : ' — saved to Candidates'}
                      </h2>
                      <div className="flex items-center gap-3">
                        {screenResults.some(r => r.draft || (!r.db_id && !r.persisted)) && (
                          <button
                            type="button"
                            onClick={() => {
                              setScreenResults([])
                              setScreenSingleFile(null)
                              setWorkspaceBanner('Screening drafts discarded.')
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold"
                          >
                            Discard all drafts
                          </button>
                        )}
                        <button onClick={() => setActiveTab('candidates')}
                          className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2">
                          View in Candidates →
                        </button>
                      </div>
                    </div>
                    {screenResults.map((r, i) => {
                      const draftKey = (r as ScreenResult & { _draftKey?: string })._draftKey || r.db_id || r.filename || String(i)
                      return (
                      <ScreenResultCard
                        key={draftKey}
                        result={r}
                        jobPostId={screenJobId || undefined}
                        originalFile={
                          screenMode === 'single' && screenSingleFile && (r.filename === screenSingleFile.name || screenResults.length === 1)
                            ? screenSingleFile
                            : bulkTexts.find(b => b.filename === r.filename)?.file
                        }
                        onSaved={(updated) => {
                          setScreenResults(prev => prev.map(row => {
                            const key = (row as ScreenResult & { _draftKey?: string })._draftKey || row.db_id || row.filename
                            return key === draftKey ? { ...updated, _draftKey: draftKey } as ScreenResult : row
                          }))
                          loadData()
                          setWorkspaceBanner('Candidate saved — Resume and Screenings are ready in Candidate 360.')
                        }}
                        onDiscard={() => {
                          setScreenResults(prev => prev.filter(row => {
                            const key = (row as ScreenResult & { _draftKey?: string })._draftKey || row.db_id || row.filename
                            return key !== draftKey
                          }))
                        }}
                        defaultOpen={screenResults.length === 1}
                      />
                      )
                    })}
                  </div>
                )}
              </div>
              </div>
            )}

            {/* ── COMPOSE ──────────────────────────────────────────────────── */}
            {activeTab === 'compose' && (
              <div>
                <button type="button" onClick={() => setActiveTab('coach')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← AI Assistant</button>
                <div className="dash-section-head">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="dash-section-icon">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>AI Compose</h1>
                      <p className="text-sm text-slate-500 mt-0.5">Generate, rewrite or reply to recruitment messages</p>
                    </div>
                  </div>
                </div>

                {/* ── Two mode cards ─────────────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">

                  {/* ── Panel A: Generate New Email ── */}
                  <div className={`rounded-2xl border p-5 transition-all ${
                    composeMode === 'generate'
                      ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100 shadow-sm'
                      : 'border-slate-200 bg-slate-50/60 opacity-60 hover:opacity-80'
                  }}`}>
                    <button
                      className="w-full text-left mb-4"
                      onClick={() => setComposeMode('generate')}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${composeMode === 'generate' ? 'border-indigo-400 bg-indigo-400' : 'border-gray-600'}`}>
                          {composeMode === 'generate' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-semibold text-gray-800">Generate New Email</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">From scratch</span>
                      </div>
                      <p className="text-xs text-gray-500 pl-5">Choose email type, fill in details — AI writes it for you</p>
                    </button>

                    {composeMode === 'generate' && (
                      <div className="space-y-4">
                        {/* Email type grid */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Email Type</label>
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
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Platform + Tone */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-600 font-medium mb-1 block">Platform</label>
                            <select value={platform} onChange={e => setPlatform(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-indigo-400">
                              {['Gmail', 'LinkedIn', 'WhatsApp', 'Outlook', 'Telegram'].map(p => <option key={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 font-medium mb-1 block">Tone</label>
                            <select value={tone} onChange={e => setTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-indigo-400">
                              {['formal', 'professional', 'semi-formal', 'friendly', 'casual'].map(t => <option key={t}>{t}</option>)}
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
                              <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                              <input value={composeFields[key]} onChange={e => setComposeFields(p => ({ ...p, [key]: e.target.value }))}
                                placeholder={placeholder}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 font-medium mb-1 block">Custom Notes (optional)</label>
                          <textarea value={composeFields.custom_notes} onChange={e => setComposeFields(p => ({ ...p, custom_notes: e.target.value }))}
                            rows={2} placeholder="Any extra details for the AI to include…"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Panel B: Rewrite / Paraphrase / Reply ── */}
                  <div className={`rounded-2xl border p-5 transition-all ${
                    composeMode !== 'generate'
                      ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100 shadow-sm'
                      : 'border-slate-200 bg-slate-50/60 opacity-60 hover:opacity-80'
                  }}`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full border-2 ${composeMode !== 'generate' ? 'border-indigo-400 bg-indigo-400' : 'border-gray-300'}`} />
                        <span className="text-sm font-semibold text-gray-800">Rewrite / Paraphrase / Reply</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">Existing message</span>
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
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                          }`}>
                          <span className="font-semibold text-sm">{label}</span>
                          <span className={`text-[10px] mt-0.5 ${composeMode === key ? 'text-indigo-200' : 'text-gray-600'}`}>{desc}</span>
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
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none" />
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
                                <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                                <input value={composeFields[key]} onChange={e => setComposeFields(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={placeholder}
                                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Platform + Tone — always shown in Panel B */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-600 font-medium mb-1 block">Platform</label>
                            <select value={platform} onChange={e => setPlatform(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-indigo-400">
                              {['Gmail', 'LinkedIn', 'WhatsApp', 'Outlook', 'Telegram'].map(p => <option key={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 font-medium mb-1 block">Tone</label>
                            <select value={tone} onChange={e => setTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-indigo-400">
                              {['formal', 'professional', 'semi-formal', 'friendly', 'casual'].map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 font-medium mb-1 block">Extra instructions (optional)</label>
                          <input value={composeFields.custom_notes} onChange={e => setComposeFields(p => ({ ...p, custom_notes: e.target.value }))}
                            placeholder="e.g. keep it under 3 sentences, mention the referral bonus…"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
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
                          : 'bg-indigo-600 hover:bg-indigo-500'
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
                          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition-all">
                          {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                        </button>
                        <button onClick={runCompose}
                          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition-all">
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
                  composeOutput ? 'border-gray-200 bg-white shadow-sm' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Output</span>
                      {composeOutput && (
                        <span className="text-xs text-gray-600">· {composeOutput.split(' ').length} words</span>
                      )}
                    </div>
                    {composeMode !== 'generate' && composeOutput && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                        {composeMode === 'reply' ? 'Reply drafted' : composeMode === 'paraphrase' ? 'Paraphrased' : 'Rewritten'}
                      </span>
                    )}
                  </div>
                  <div className={`px-5 py-5 text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] ${
                    composeOutput ? 'text-gray-800' : 'text-gray-500 flex items-center justify-center'
                  }`}>
                    {composeOutput || (
                      <div className="text-center py-4 w-full">
                        <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-xs">
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
                <div className="dash-section-head">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="dash-section-icon">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>Job Posts</h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {filteredJobs.length}{filteredJobs.length !== jobs.length ? ` of ${jobs.length}` : ''} job{filteredJobs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowNewJob(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-orange-900/15 transition-colors">
                    <Plus className="w-4 h-4" /> New Job
                  </button>
                </div>

                {pendingAiAction === 'gen-post' && (
                  <div className="mb-5 rounded-2xl border border-[#166534]/25 bg-[#ecfdf3]/50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#166534]">Generate Job Post</p>
                        <p className="text-xs text-[#14532d] mt-1">
                          Generate from an existing job, or Quick Generate from pasted / uploaded JD text without creating a job first.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setPendingAiAction(null); openGenPostModal('existing') }}
                            className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#F97316] text-white hover:bg-[#ea580c]">
                            From existing job
                          </button>
                          <button type="button" onClick={() => { setPendingAiAction(null); openGenPostModal('quick') }}
                            className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-[#166534]/30 bg-white text-[#166534] hover:bg-[#ecfdf3]">
                            Quick Generate
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-indigo-900/70 hover:text-indigo-900 hover:bg-indigo-200/40 transition-colors"
                        aria-label="Dismiss"
                        onClick={() => setPendingAiAction(null)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Filter Bar ── */}
                <div className="flex items-center gap-3 mb-5 flex-wrap rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-950/[0.02]">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Filter</span>
                  </div>
                  <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Role</span>
                    <input value={filterJobRole} onChange={e => setFilterJobRole(e.target.value)}
                      placeholder="Role or JOB-ID…"
                      className="pl-2 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 w-32" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Company</span>
                    <input value={filterJobCompany} onChange={e => setFilterJobCompany(e.target.value)}
                      placeholder="Search company…"
                      className="pl-2 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 w-32" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Status</span>
                    <select value={filterJobStatus} onChange={e => setFilterJobStatus(e.target.value)}
                      className="appearance-none pl-2 pr-6 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15">
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Job Type</span>
                    <select value={filterJobType} onChange={e => setFilterJobType(e.target.value)}
                      className="appearance-none pl-2 pr-6 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15">
                      <option value="">All</option>
                      <option value="full-time">Full-Time</option>
                      <option value="part-time">Part-Time</option>
                      <option value="contract">Contract</option>
                      <option value="remote">Remote</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  {(filterJobStatus || filterJobType || filterJobRole || filterJobCompany) && (
                    <button onClick={() => { setFilterJobStatus(''); setFilterJobType(''); setFilterJobRole(''); setFilterJobCompany('') }}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 hover:border-red-200 transition-colors">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                  <span className="ml-auto text-xs font-semibold text-slate-400">{filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center">
                    <Briefcase className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">{jobs.length === 0 ? 'No jobs yet. Create your first job post.' : 'No jobs match the selected filters.'}</p>
                    {jobs.length === 0 && (
                      <button onClick={() => setShowNewJob(true)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-orange-900/15 transition-all">
                        Create Job Post
                      </button>
                    )}
                  </div>
                ) : (
                  <ScrollableTable stickyX>
                    <table className="ent-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Role</th>
                          <th>Company</th>
                          <th>Location</th>
                          <th>Type</th>
                          <th className="text-center">Candidates</th>
                          <th>Status</th>
                          <th>Posted</th>
                          <th>Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJobs.map(job => {
                          const jobCands = candidates.filter(c => c.job_posts?.id === job.id)
                          const stageSummary = PIPELINE_STAGES.slice(1).map(s => ({ ...s, count: jobCands.filter(c => c.pipeline_stage === s.key).length }))
                          return (
                            <tr key={job.id} onClick={() => router.push(`/dashboard/jobs/${job.id}`)} className="cursor-pointer hover:bg-indigo-50/30 transition-colors">
                              <td><ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} /></td>
                              <td>
                                <p className="font-semibold text-gray-900 text-sm">{job.title}</p>
                              </td>
                              <td className="text-sm text-gray-600">{job.company || '—'}</td>
                              <td className="text-sm text-gray-500">{job.location || '—'}</td>
                              <td className="text-sm text-gray-500 capitalize">{job.type || '—'}</td>
                              <td className="text-center" onClick={e => e.stopPropagation()}>
                                <button onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                                  className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                                  <Users className="w-3.5 h-3.5" />
                                  {jobCands.length}
                                </button>
                                {jobCands.length > 0 && (
                                  <div className="flex items-center gap-0.5 mt-1 justify-center flex-wrap">
                                    {stageSummary.filter(s => s.count > 0).slice(0, 4).map(s => (
                                      <span key={s.key} className={`text-[10px] px-1 py-0 rounded border font-semibold ${STAGE_LIGHT[s.key]?.bg} ${STAGE_LIGHT[s.key]?.text} ${STAGE_LIGHT[s.key]?.border}`}>{s.label[0]}: {s.count}</span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${job.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                  {job.status}
                                </span>
                              </td>
                              <td className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                              <td className="text-xs text-gray-400 whitespace-nowrap">{job.updated_at && job.updated_at !== job.created_at ? fmtDate(job.updated_at) : '—'}</td>
                              <td>
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <Users className="w-3 h-3" /> Candidates
                                  </button>
                                  <button onClick={() => openJobDetails(job)}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                    <Sparkles className="w-3 h-3" /> {job.post_contents ? 'Posts' : 'JD'}
                                  </button>
                                  <button onClick={() => { setSelectedJob(job.id); setFilterJob(job.id); setActiveTab('candidates') }}
                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium whitespace-nowrap">
                                    Candidates <ArrowRight className="w-3 h-3" />
                                  </button>
                                  {tenantRole !== 'viewer' && (
                                    <DeleteActionButton
                                      resourceType="job"
                                      resourceId={job.id}
                                      resourceLabel={job.short_id || job.title || 'Job'}
                                      canDirectDelete={isTenantAdminOrOwner || Boolean(tenantPermissions?.jobs?.delete)}
                                      onDone={({ direct }) => {
                                        if (direct) setJobs(prev => prev.filter(j => j.id !== job.id))
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollableTable>
                )}
              </div>
            )}

            {/* ── ANALYTICS ────────────────────────────────────────────────── */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">

                <div className="dash-section-head">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="dash-section-icon">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>Recruitment Analytics</h1>
                      <p className="text-sm text-slate-500 mt-0.5">Live snapshot of your hiring pipeline and team performance</p>
                    </div>
                  </div>
                  <button onClick={loadData} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition-all">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                {/* ── KPI Row ── */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Candidates',
                      value: totalCandidates,
                      icon: Users,
                      iconBg: 'bg-blue-100',
                      iconColor: 'text-blue-600',
                      accent: 'border-t-blue-500',
                      sub: `${jobs.length} active job${jobs.length !== 1 ? 's' : ''}`,
                    },
                    {
                      label: 'In Interview',
                      value: interviewCount,
                      icon: Clock,
                      iconBg: 'bg-amber-100',
                      iconColor: 'text-amber-600',
                      accent: 'border-t-amber-500',
                      sub: totalCandidates > 0 ? `${Math.round((interviewCount / totalCandidates) * 100)}% of pipeline` : 'No candidates yet',
                    },
                    {
                      label: 'Total Hired',
                      value: hiredCount,
                      icon: CheckCircle,
                      iconBg: 'bg-emerald-100',
                      iconColor: 'text-emerald-600',
                      accent: 'border-t-emerald-500',
                      sub: 'Offer accepted & onboarded',
                    },
                    {
                      label: 'Conversion Rate',
                      value: totalCandidates > 0 ? `${Math.round((hiredCount / totalCandidates) * 100)}%` : '—',
                      icon: TrendingUp,
                      iconBg: 'bg-sky-100',
                      iconColor: 'text-sky-600',
                      accent: 'border-t-sky-500',
                      sub: 'Candidates → Hired',
                    },
                  ].map(({ label, value, icon: Icon, iconBg, iconColor, accent, sub }) => (
                    <div key={label} className={`bg-white rounded-xl p-5 border border-gray-200 border-t-4 ${accent} shadow-sm`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${iconColor}`} />
                        </div>
                      </div>
                      <p className="text-3xl font-extrabold text-gray-900 mb-1">{value}</p>
                      <p className="text-xs font-semibold text-gray-600">{label}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* ── Middle Row: Funnel + Match Quality ── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                  {/* Hiring Funnel */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-gray-800">Hiring Funnel</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Candidate distribution across pipeline stages</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">{totalCandidates} total</span>
                    </div>
                    <div className="p-5 space-y-3">
                      {PIPELINE_STAGES.map(s => {
                        const count = stageCounts[s.key] ?? 0
                        const pct = totalCandidates > 0 ? (count / totalCandidates) * 100 : 0
                        const barColors: Record<string, string> = {
                          sourced: 'bg-slate-400', applied: 'bg-[#166534]', screening: 'bg-[#F97316]',
                          interview: 'bg-amber-500', offer: 'bg-[#22C55E]', hired: 'bg-[#14532d]',
                        }
                        return (
                          <div key={s.key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700 w-20">{s.label}</span>
                              <div className="flex-1 mx-3 h-6 bg-gray-100 rounded overflow-hidden">
                                <div
                                  className={`h-full rounded transition-all duration-500 ${barColors[s.key] ?? 'bg-blue-400'} flex items-center`}
                                  style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}>
                                  {pct > 15 && <span className="text-[10px] font-bold text-white pl-2">{Math.round(pct)}%</span>}
                                </div>
                              </div>
                              <div className="text-right w-12">
                                <span className="text-sm font-bold text-gray-800">{count}</span>
                                {pct > 0 && pct <= 15 && <span className="text-[10px] text-gray-400 ml-1">{Math.round(pct)}%</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {totalCandidates === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm">No candidates in pipeline yet</div>
                      )}
                    </div>
                  </div>

                  {/* AI Match Quality */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-800">AI Match Quality</h2>
                      <p className="text-xs text-gray-400 mt-0.5">How well candidates match your job requirements</p>
                    </div>
                    <div className="p-5">
                      {(() => {
                        const total = Object.values(matchCounts).reduce((a, b) => a + b, 0)
                        const items = [
                          { key: 'best',    label: 'Best Match',    bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
                          { key: 'good',    label: 'Good Match',    bar: 'bg-[#166534]',   text: 'text-[#166534]',   bg: 'bg-[#ecfdf3]',   border: 'border-[#166534]/20' },
                          { key: 'partial', label: 'Partial Match', bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
                          { key: 'poor',    label: 'Low Match',     bar: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
                        ]
                        if (total === 0) return <div className="text-center py-8 text-gray-400 text-sm">Run AI screening to see match quality data</div>
                        return (
                          <>
                            <div className="space-y-3 mb-4">
                              {items.map(({ key, label, bar, text, bg, border }) => {
                                const count = matchCounts[key] ?? 0
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                                return (
                                  <div key={key}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-gray-600">{label}</span>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${bg} ${text} ${border}`}>{count}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {/* Segment bar */}
                            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mt-4">
                              {items.map(({ key, bar }) => {
                                const count = matchCounts[key] ?? 0
                                const pct = total > 0 ? (count / total) * 100 : 0
                                return pct > 0 ? <div key={key} className={`${bar} transition-all`} style={{ width: `${pct}%` }} /> : null
                              })}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Tenant funnel (admin/owner) */}
                {isTenantAdminOrOwner && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-gray-800">Tenant Funnel</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Workspace-wide pipeline over the last {tenantFunnel?.period_days ?? 90} days</p>
                      </div>
                      {tenantFunnelLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    </div>
                    <div className="p-5">
                      {tenantFunnelLoading && !tenantFunnel ? (
                        <div className="text-center py-6 text-gray-400 text-sm">Loading tenant funnel…</div>
                      ) : tenantFunnel && Object.keys(tenantFunnel.funnel).length > 0 ? (
                        <div className="space-y-3">
                          {PIPELINE_STAGES.map(s => {
                            const count = tenantFunnel.funnel[s.key] ?? 0
                            const total = Object.values(tenantFunnel.funnel).reduce((a, b) => a + b, 0)
                            const pct = total > 0 ? (count / total) * 100 : 0
                            return (
                              <div key={s.key} className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-gray-700 w-20">{s.label}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#166534] rounded-full" style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-sm">No tenant funnel data for this period</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Bottom Row: Top Skills + Activity Stats ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

                  {/* Top Skills — spans 2 columns */}
                  <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-gray-800">Top Skills in Pipeline</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Most common skills across all screened candidates</p>
                      </div>
                      {topSkills.length > 0 && <span className="text-xs text-gray-400">{topSkills.length} unique skills</span>}
                    </div>
                    <div className="p-5">
                      {topSkills.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Skills data appears after AI screening</div>
                      ) : (
                        <div className="space-y-2.5">
                          {topSkills.slice(0, 10).map(({ skill, count }, idx) => {
                            const pct = Math.round((count / topSkills[0].count) * 100)
                            const barColors = ['bg-[#166534]', 'bg-[#F97316]', 'bg-[#14532d]', 'bg-[#22C55E]', 'bg-[#ea580c]']
                            const barColor = barColors[idx % barColors.length]
                            return (
                              <div key={skill} className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-gray-400 w-4">{idx + 1}</span>
                                <button
                                  onClick={() => { setFilterSkill(skill); setActiveTab('candidates') }}
                                  className="text-xs font-medium text-gray-700 w-32 truncate text-left hover:text-blue-600 transition-colors"
                                  title={`View candidates with ${skill}`}>
                                  {skill}
                                </button>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload Activity */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-800">Upload Activity</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Candidate additions over time</p>
                    </div>
                    <div className="p-5 space-y-3">
                      {(() => {
                        const now = Date.now()
                        const msDay = 86400000
                        const today  = candidates.filter(c => c.created_at && now - new Date(c.created_at).getTime() < msDay).length
                        const last7  = candidates.filter(c => c.created_at && now - new Date(c.created_at).getTime() < 7 * msDay).length
                        const last30 = candidates.filter(c => c.created_at && now - new Date(c.created_at).getTime() < 30 * msDay).length
                        return ([
                          { label: 'Today',        value: today,  dateFilter: 'today'  as const, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
                          { label: 'Last 7 days',  value: last7,  dateFilter: '7days'  as const, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                          { label: 'Last 30 days', value: last30, dateFilter: '30days' as const, color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
                        ]).map(({ label, value, dateFilter, color, bg, border }) => (
                          <button key={label}
                            onClick={() => { setFilterDate(dateFilter); setActiveTab('candidates') }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border ${bg} ${border} hover:opacity-80 transition-opacity`}>
                            <span className="text-xs font-medium text-gray-600">{label}</span>
                            <span className={`text-xl font-extrabold ${color}`}>{value}</span>
                          </button>
                        ))
                      })()}
                      <p className="text-[11px] text-gray-400 pt-1">Click any row to see those candidates →</p>
                    </div>

                    {/* Job breakdown */}
                    {jobs.length > 0 && (
                      <div className="px-5 pb-5">
                        <p className="text-xs font-bold text-gray-600 mb-3 uppercase tracking-wide">By Job Post</p>
                        <div className="space-y-2">
                          {jobs.slice(0, 5).map(j => {
                            const cnt = candidates.filter(c => c.job_posts?.id === j.id).length
                            return (
                              <button key={j.id}
                                onClick={() => { setFilterJob(j.id); setActiveTab('candidates') }}
                                className="w-full flex items-center justify-between hover:bg-gray-50 rounded px-1 py-1 transition-colors group">
                                <span className="text-xs text-gray-600 truncate group-hover:text-blue-600 flex-1 text-left">{j.title}</span>
                                <span className="text-xs font-bold text-gray-700 ml-2">{cnt}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SETTINGS ─────────────────────────────────────────────────── */}
            {activeTab === 'settings' && settingsPanel === 'main' && (
              <div className="max-w-3xl">
                <div className="dash-section-head">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="dash-section-icon">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-[var(--dash-heading)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Account Settings</h1>
                      <p className="text-sm text-[var(--dash-text-2)] mt-0.5">Manage your profile, appearance, subscription and API access</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button type="button" onClick={() => setSettingsPanel('integrations')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          Integrations catalog
                        </button>
                        <button type="button" onClick={() => setSettingsPanel('security')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          Security Center
                        </button>
                        {canSeeGovernance && (
                          <button type="button" onClick={() => setSettingsPanel('governance')}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                            Governance
                          </button>
                        )}
                        <button type="button" onClick={() => setActiveTab('import')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          Import engine
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isTenantAdminOrOwner && (
                  <div className="mb-5">
                    <DeleteApprovalsPanel onChanged={() => { void loadData() }} />
                  </div>
                )}

                {isTenantAdminOrOwner && (
                  <div className="mb-5">
                    <RagReindexPanel />
                  </div>
                )}

                <div className="mb-5">
                  <AppearanceSettings />
                </div>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : profileData ? (
                  <div className="space-y-5">

                    {/* Profile Card */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm ring-1 ring-slate-950/[0.02]">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-blue-600" />
                          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Profile</h2>
                        </div>
                        {!editingName && (
                          <button onClick={() => { setEditName(profileData.user.name || ''); setEditingName(true) }}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-5">
                        {profileData.user.image
                          ? /* eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL from session */
                            <img src={profileData.user.image} alt="" className="w-16 h-16 rounded-full ring-2 ring-blue-200" />
                          : <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ring-2 ring-blue-200 bg-[#166534]">
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
                                    className="px-2 py-1 rounded text-white text-xs hover:bg-[#14532d] disabled:opacity-50 bg-[#166534]">
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
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Subscription</h2>
                      </div>
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider ${
                          profileData.subscription.plan === 'pro'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
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
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
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
                          { label: 'AI Screens',   value: profileData.usage.screens_this_month,  limit: profileData.subscription.plan === 'free' ? PLAN_LIMITS.free.ai_screens_per_month : null, icon: Brain,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
                          { label: 'AI Compose',   value: profileData.usage.composes_this_month, limit: null,                                                  icon: Mail,       color: 'text-blue-600',   bg: 'bg-blue-50' },
                          { label: 'Candidates',   value: profileData.usage.total_candidates,    limit: null,                                                  icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50' },
                          { label: 'Active Jobs',  value: profileData.usage.active_jobs,         limit: profileData.subscription.plan === 'free' ? PLAN_LIMITS.free.job_posts : null,   icon: Briefcase,  color: 'text-amber-600',  bg: 'bg-amber-50' },
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
                                  <div className={`h-full rounded-full transition-all ${value >= limit ? 'bg-red-500' : 'bg-blue-500'}`}
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

                    {/* Email & Calendar Connections */}
                    <EmailCalendarHub />

                    {/* API Keys for n8n / ATS Integration */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-amber-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">API Integration</h2>
                      </div>
                      <p className="text-xs text-gray-500 mb-5">Generate an API key to integrate SmartRecruit with n8n, your ATS, or any external system.</p>

                      {generatedKey && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-xs text-amber-700 mb-2 font-medium">Your new API key (copy it now — it will not be shown again):</p>
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
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 hover:bg-[#14532d] bg-[#166534]">
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
                                  intg.provider === 'monster' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
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
                            <label className="text-xs font-semibold text-gray-700 mb-1 block">Platform</label>
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
                            <label className="text-xs font-semibold text-gray-700 mb-1 block">API Key</label>
                            <input type="password" value={intgApiKey} onChange={e => setIntgApiKey(e.target.value)}
                              placeholder="Paste API key"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1 block">Webhook URL <span className="text-gray-400">(optional)</span></label>
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

                    {/* Team Management */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm ring-1 ring-slate-950/[0.02]">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 mb-4 text-xs text-slate-700 leading-relaxed">
                        <p className="font-semibold text-slate-900 mb-1">SaaS workspace model</p>
                        <p>Each subscription/workspace (<span className="font-mono">tenant</span>) has its own jobs, candidates, integrations, and team. Duplicates and permissions are evaluated <strong>only</strong> inside this workspace — data is never merged with other tenants.</p>
                        <p className="mt-2 text-slate-600">
                          <span className="font-semibold text-slate-800">Member tenure:</span> after <span className="font-mono font-semibold">{WORKSPACE_MEMBER_TENURE_REVIEW_MONTHS} months</span> in this workspace, admins may reassign primary ownership of shared operational duties (similar in spirit to a 6‑month rule elsewhere; here we use {WORKSPACE_MEMBER_TENURE_REVIEW_MONTHS} months for team alignment).
                        </p>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-600" />
                          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Team Members</h2>
                        </div>
                        {teamLoading && <span className="text-xs text-gray-400">Loading…</span>}
                      </div>
                      {/* Members list */}
                      <div className="divide-y divide-gray-100 mb-5">
                        {teamMembers.length === 0 && !teamLoading && (
                          <p className="text-sm text-gray-400 py-2">No team members yet.</p>
                        )}
                        {teamMembers.map(m => (
                          <div key={m.id} className="flex items-center justify-between py-2.5 gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{m.name ?? m.email}</p>
                              <p className="text-xs text-gray-500 truncate">{m.email}</p>
                              {m.invite_accepted && m.role !== 'owner' && monthsSince(m.created_at) >= WORKSPACE_MEMBER_TENURE_REVIEW_MONTHS && (
                                <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Tenure ≥ {WORKSPACE_MEMBER_TENURE_REVIEW_MONTHS} mo — eligible for admin ownership review</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!m.invite_accepted && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                              )}
                              {m.role === 'owner' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">owner</span>
                              ) : (
                                <select
                                  value={m.role}
                                  onChange={e => changeMemberRole(m.id, e.target.value)}
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  title="Change role"
                                >
                                  <option value="admin">admin</option>
                                  <option value="recruiter">recruiter</option>
                                  <option value="member">member</option>
                                  <option value="viewer">viewer</option>
                                </select>
                              )}
                              {m.role !== 'owner' && (
                                <button onClick={() => removeMember(m.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove member">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Invite form */}
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Invite a team member</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendTeamInvite()}
                            placeholder="colleague@company.com"
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <select
                            value={inviteRole}
                            onChange={e => setInviteRole(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="recruiter">Recruiter</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={sendTeamInvite}
                            disabled={inviting || !inviteEmail.trim()}
                            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {inviting ? 'Sending…' : 'Invite'}
                          </button>
                        </div>
                        {inviteResult && (
                          <p className={`mt-2 text-xs break-all ${inviteResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                            {inviteResult.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Audit Trail */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm ring-1 ring-slate-950/[0.02]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Audit Trail</h2>
                        </div>
                        <button onClick={loadAuditLogs} disabled={auditLoading}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                          {auditLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Refresh
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">Recent account activity — stage changes, job posts, AI screens, and logins.</p>
                      {auditLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        </div>
                      ) : auditLogs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">No activity recorded yet.</p>
                      ) : (
                        <ScrollableTable stickyX>
                          <table className="ent-table w-full">
                            <thead>
                              <tr>
                                <th>Action</th>
                                <th>Resource</th>
                                <th>ID</th>
                                <th>Result</th>
                                <th>When</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map(log => (
                                <tr key={log.id}>
                                  <td className="font-mono">{log.action}</td>
                                  <td className="capitalize">{log.resource_type}</td>
                                  <td className="font-mono text-slate-500">{log.resource_id ? log.resource_id.slice(0, 12) + '…' : '—'}</td>
                                  <td>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.result === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                      {log.result}
                                    </span>
                                  </td>
                                  <td className="text-slate-500 whitespace-nowrap">{fmtDate(log.created_at, true)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </ScrollableTable>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-sm">Failed to load profile data.
                    <button onClick={loadProfile} className="ml-2 text-blue-600 hover:underline">Retry</button>
                  </div>
                )}
              </div>
            )}

            {/* ── JD INTELLIGENCE ─────────────────────────────────────────── */}
            {activeTab === 'jd' && (
              <div>
                <button type="button" onClick={() => setActiveTab('coach')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← AI Assistant</button>
                <JDTab />
              </div>
            )}

            {/* ── BOOLEAN SEARCH ──────────────────────────────────────────── */}
            {activeTab === 'boolean' && (
              <div>
                <button type="button" onClick={() => setActiveTab('coach')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← AI Assistant</button>
                <BooleanTab key={booleanJobId ?? 'boolean-blank'} initialJobId={booleanJobId} />
              </div>
            )}

            {/* ── IMPORT ENGINE ───────────────────────────────────────────── */}
            {activeTab === 'import' && (
              <div>
                <button type="button" onClick={() => setActiveTab('candidates')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← Candidates</button>
                <ImportTab />
              </div>
            )}

            {/* ── INTEGRATION HUB ─────────────────────────────────────────── */}
            {activeTab === 'integrations' && <IntegrationsTab />}

            {/* ── COMMUNICATION HUB ───────────────────────────────────────── */}
            {activeTab === 'comms' && <CommsHubTab onNavigate={(tab) => setActiveTab(tab as DashboardTab)} />}

            {/* ── SUBMISSIONS ─────────────────────────────────────────────── */}
            {activeTab === 'submissions' && (
              <SubmissionsTab
                isManager={isTenantAdminOrOwner}
                onOpenCandidate={(idOrShort) => {
                  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrShort)
                  if (uuidLike) {
                    router.push(`/dashboard/candidates/${idOrShort}`)
                    return
                  }
                  const c = candidates.find(x => (x.short_id ?? '').toUpperCase() === idOrShort.toUpperCase() || x.id === idOrShort)
                  if (c) router.push(`/dashboard/candidates/${c.id}`)
                  else { setSearchQ(idOrShort); setActiveTab('candidates') }
                }} />
            )}

            {/* ── INTERVIEWS ────────────────────────────────────────────────── */}
            {activeTab === 'interviews' && (
              <InterviewsTab
                isManager={isTenantAdminOrOwner}
                onOpenCandidate={(idOrShort) => {
                  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrShort)
                  if (uuidLike) {
                    router.push(`/dashboard/candidates/${idOrShort}`)
                    return
                  }
                  const c = candidates.find(x => (x.short_id ?? '').toUpperCase() === idOrShort.toUpperCase() || x.id === idOrShort)
                  if (c) router.push(`/dashboard/candidates/${c.id}`)
                  else { setSearchQ(idOrShort); setActiveTab('candidates') }
                }}
              />
            )}

            {/* ── FOLLOW-UPS ────────────────────────────────────────────────── */}
            {activeTab === 'followups' && <FollowUpsTab />}

            {/* ── SELECTED / OFFERS ─────────────────────────────────────────── */}
            {activeTab === 'selected' && (
              <SelectedPipelineTab
                isManager={isTenantAdminOrOwner}
                onOpenCandidate={(shortId) => {
                const c = candidates.find(x => (x.short_id ?? '').toUpperCase() === shortId.toUpperCase() || x.id === shortId)
                if (c) router.push(`/dashboard/candidates/${c.id}`)
                else { setSearchQ(shortId); setActiveTab('candidates') }
              }} />
            )}

            {/* ── INTERNAL TALENT POOL ──────────────────────────────── */}
            {activeTab === 'talent' && <InternalTalentPoolTab />}

            {activeTab === 'clients' && (
              <ClientsTab
                canDirectDelete={isTenantAdminOrOwner || Boolean(tenantPermissions?.candidates?.delete)}
                canRequestDelete={tenantRole !== 'viewer'}
              />
            )}
            {activeTab === 'recruiters' && (
              canSeeRecruiters
                ? <RecruitersTab teamMembers={teamMembers} />
                : <div className="dash-page-shell py-16 text-center text-slate-600 font-semibold">Access denied — Recruiters module is for managers and admins only.</div>
            )}
            {activeTab === 'documents' && <DocumentsRegistryTab />}
            {activeTab === 'reports' && <ReportsTab onNavigate={(tab) => setActiveTab(tab as DashboardTab)} />}
            {activeTab === 'hrconfig' && <HrConfigTab />}
            {activeTab === 'performance' && <MyPerformanceTab />}
            {activeTab === 'coach' && (
              <AiRecruiterWorkspace
                bootstrapTemplateId={coachBootstrapTemplateId}
                onNavigate={(tab) => {
                  if (tab === 'gen-post') {
                    setActiveAiShortcutId('gen-post')
                    setCoachBootstrapTemplateId(null)
                    setPendingAiAction('gen-post')
                    setActiveTab('jobs')
                    return
                  }

                  const t = tab as DashboardTab
                  const shortcutMap: Partial<Record<DashboardTab, string>> = {
                    coach: 'hub',
                    screen: 'screen',
                    compose: 'compose',
                    jd: 'jd',
                    boolean: 'boolean',
                  }
                  setActiveAiShortcutId(shortcutMap[t] ?? null)
                  setCoachBootstrapTemplateId(null)
                  setPendingAiAction(null)
                  setActiveTab(t)
                }}
              />
            )}
            {activeTab === 'settings' && settingsPanel === 'governance' && canSeeGovernance && (
              <div>
                <button type="button" onClick={() => setSettingsPanel('main')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← Back to Settings</button>
                <GovernanceTab />
              </div>
            )}
            {activeTab === 'settings' && settingsPanel === 'security' && (
              <div>
                <button type="button" onClick={() => setSettingsPanel('main')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← Back to Settings</button>
                <SecurityCenterTab onOpenMfa={() => {
                  window.location.hash = 'mfa'
                  setSettingsPanel('security')
                }} />
              </div>
            )}
            {activeTab === 'settings' && settingsPanel === 'integrations' && (
              <div>
                <button type="button" onClick={() => setSettingsPanel('main')} className="mb-3 text-sm font-bold text-indigo-700 hover:underline">← Back to Settings</button>
                <IntegrationsTab />
              </div>
            )}
            {activeTab === 'governance' && <GovernanceTab />}
            {activeTab === 'integrations' && <IntegrationsTab />}

            {/* ── ESS LITE ──────────────────────────────────────────────────── */}
            {activeTab === 'ess' && <ESSTab />}

          </div>
        </main>
      </div>

      <NewJobModal
        open={showNewJob}
        onClose={() => setShowNewJob(false)}
        onCreated={(job, generatePosts, platforms) => {
          loadData()
          setWorkspaceBanner(`Job created: ${String(job.title ?? 'Job')}`)
          setFilterJobStatus('')
          setFilterJobType('')
          setFilterJobRole('')
          setFilterJobCompany('')
          if (generatePosts) {
            const selected = platforms?.length ? platforms : [...JOB_POST_PLATFORMS]
            setGenPostPlatforms(selected)
            setGenPostMode('existing')
            setGenPostJob(job as unknown as Job)
            setGenPostOpen(true)
            setGeneratedPosts({})
            setGenCustomPrompt('')
            setGenPostError('')
            setAutoGeneratePosts(true)
          }
        }}
      />

      {/* ── Generate Job Posts Modal ─────────────────────────────────────── */}
      {genPostOpen && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-[70] overflow-y-auto flex items-start justify-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-2xl border border-slate-200 my-4 sm:my-8 flex flex-col max-h-[min(92vh,900px)] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">Generate Job Post</h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {genPostMode === 'existing' && genPostJob
                    ? <>{genPostJob.title}{genPostJob.company ? ` · ${genPostJob.company}` : ''}{genPostJob.short_id ? <> · <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{genPostJob.short_id}</span></> : ''}</>
                    : 'Quick generate from JD text — no job required'}
                </p>
              </div>
              <button onClick={closeGenPostModal} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4 gen-post-scroll">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setGenPostMode('existing')}
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${genPostMode === 'existing' ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <p className="text-xs font-black text-slate-900">From existing job</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Reuse JD and save posts to the job</p>
              </button>
              <button type="button" onClick={() => { setGenPostMode('quick'); setGenPostJob(null) }}
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${genPostMode === 'quick' ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <p className="text-xs font-black text-slate-900">Quick Generate</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Paste / upload JD — no job save</p>
              </button>
            </div>

            {genPostMode === 'existing' ? (
              <div className="mb-3 space-y-2">
                {!genPostJob ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto gen-post-scroll">
                    <p className="text-[10px] font-black uppercase text-slate-600 mb-2">Select a job</p>
                    {jobs.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-500">No jobs yet — use Quick Generate or New Job.</p>
                    ) : jobs.slice(0, 40).map(j => (
                      <button key={j.id} type="button" onClick={() => openJobDetails(j)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-slate-800 hover:bg-indigo-50 truncate">
                        {j.title}{j.company ? ` · ${j.company}` : ''}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-600 font-black uppercase tracking-wide">Job description</label>
                        {Object.keys(generatedPosts).length > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700">Saved posts loaded — no AI cost unless you Regenerate</span>
                        )}
                      </div>
                      <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs font-medium text-slate-700 gen-post-scroll">
                        {genPostJob.description?.trim() || 'No description saved for this job yet.'}
                      </div>
                    </div>
                    <button type="button" className="text-[11px] font-black text-indigo-700 self-start" onClick={() => { setGenPostJob(null); setGeneratedPosts({}) }}>
                      Change job
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} placeholder="Job title (optional)"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold" />
                  <input value={quickCompany} onChange={e => setQuickCompany(e.target.value)} placeholder="Company"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold" />
                  <input value={quickLocation} onChange={e => setQuickLocation(e.target.value)} placeholder="Location"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold" />
                </div>
                <textarea value={quickJdText} onChange={e => setQuickJdText(e.target.value)} rows={6}
                  placeholder="Paste full job description…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium resize-y min-h-[120px] max-h-56 overflow-y-auto gen-post-scroll" />
                <LightFileUploadZone
                  label="Upload JD (PDF/DOC/DOCX/TXT)"
                  accept=".pdf,.docx,.doc,.txt"
                  onText={t => setQuickJdText(prev => prev ? prev + '\n' + t : t)}
                  disabled={generatingPosts}
                />
              </div>
            )}

            <div className="mb-3">
              <label className="text-xs font-black text-slate-800 mb-1 block">Extra context / instructions (optional)</label>
              <input value={genCustomPrompt} onChange={e => setGenCustomPrompt(e.target.value)}
                placeholder="e.g. Highlight remote work, mention stipend…"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            </div>

            <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-black text-indigo-950">Channels to generate</p>
                <button
                  type="button"
                  onClick={() => setGenPostPlatforms(prev => prev.length === JOB_POST_PLATFORMS.length ? ['linkedin'] : [...JOB_POST_PLATFORMS])}
                  className="text-[11px] font-bold text-indigo-700 hover:underline"
                >
                  {genPostPlatforms.length === JOB_POST_PLATFORMS.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <p className="text-[10px] font-semibold text-indigo-800/80 mb-2">LinkedIn · WhatsApp · Email · Indeed only</p>
              <div className="option-card-grid !gap-1.5">
                {JOB_POST_PLATFORMS.map(p => {
                  const on = genPostPlatforms.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setGenPostPlatforms(prev =>
                        prev.includes(p) ? (prev.length === 1 ? prev : prev.filter(x => x !== p)) : [...prev, p]
                      )}
                      className={`!min-h-0 px-2.5 py-2 rounded-xl text-[11px] font-black border text-left transition-all ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-800 border-slate-200'}`}
                      title={JOB_POST_PLATFORM_META[p].hint}
                    >
                      {JOB_POST_PLATFORM_META[p].label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-3 flex gap-2">
              <button
                onClick={() => {
                  if (genPostMode === 'quick') void generateQuickPosts()
                  else if (genPostJob) void generateJobPosts(genPostJob)
                  else setGenPostError('Select a job first.')
                }}
                disabled={generatingPosts || genPostPlatforms.length === 0 || (genPostMode === 'existing' && !genPostJob) || (genPostMode === 'quick' && !quickJdText.trim())}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#166534] hover:bg-blue-500 font-black text-sm text-white transition-all disabled:opacity-50">
                {generatingPosts
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : Object.keys(generatedPosts).length > 0
                    ? <><Sparkles className="w-4 h-4" /> Generate Again</>
                    : <><Sparkles className="w-4 h-4" /> Generate posts</>
                }
              </button>
              {genPostMode === 'quick' && Object.keys(generatedPosts).length > 0 && (
                <button type="button" onClick={() => void saveQuickAsJob()} disabled={generatingPosts}
                  className="px-3 py-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-black hover:bg-emerald-100 disabled:opacity-50">
                  Save as Job
                </button>
              )}
            </div>

            {genPostError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold mb-3">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {genPostError}
              </div>
            )}

            {Object.keys(generatedPosts).length > 0 ? (
              <div className="flex flex-col pb-2">
                <div className="flex gap-1 flex-wrap mb-2">
                  {JOB_POST_PLATFORMS.map(p => (
                    generatedPosts[p] ? (
                      <button key={p} onClick={() => setGenPostTab(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-black transition-all ${genPostTab === p ? 'bg-[#166534] text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                        {JOB_POST_PLATFORM_META[p].label}
                      </button>
                    ) : null
                  ))}
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedPosts[genPostTab] ?? ''}
                    rows={12}
                    className="w-full min-h-[220px] max-h-[360px] overflow-y-auto px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-800 resize-y focus:outline-none gen-post-scroll" />
                  <button
                    onClick={() => copyPostContent(genPostTab, generatedPosts[genPostTab] ?? '')}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all border border-slate-200">
                    {copiedPostKey === genPostTab ? <><Check className="w-3 h-3 text-emerald-600" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 mb-1">
                <p className="font-black mb-1">
                  {genPostMode === 'quick' ? 'Paste or upload a JD, then generate.' : 'No saved posts yet for this job.'}
                </p>
                <p className="text-xs font-semibold text-amber-900/90">
                  Generate once to create LinkedIn, WhatsApp, Email, and Indeed posts. Opening an existing job with saved posts will not spend AI tokens until you Generate Again.
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ── Job 360° + legacy detail ─────────────────────────────────────── */}
      {selectedJobView && (
        <Job360View
          jobId={selectedJobView.id}
          onClose={() => setSelectedJobView(null)}
          onOpenCandidate={(id) => {
            router.push(`/dashboard/candidates/${id}`)
          }}
          onNavigate={(tab) => {
            if (tab === 'boolean' || tab === 'screen') {
              const id = selectedJobView.id
              setSelectedJobView(null)
              if (tab === 'boolean') setBooleanJobId(id)
              if (tab === 'screen') {
                setScreenJobId(id)
                void (async () => {
                  try {
                    const res = await fetch(`/api/jobs/${id}/screening-context`)
                    const data = await res.json()
                    if (res.ok && data.jd_text) {
                      setJdText(data.jd_text)
                      setScreenJobMeta({ title: data.title, client: data.client, loading: false })
                    }
                  } catch { /* ignore */ }
                })()
              }
              setActiveTab(tab as DashboardTab)
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href)
                url.searchParams.set('tab', tab)
                url.searchParams.set('job_post_id', id)
                window.history.replaceState({}, '', url.toString())
              }
              return
            }
            setActiveTab(tab as DashboardTab)
          }}
        />
      )}

      {/* ── Candidate Detail Modal ──────────────────────────────────────────── */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          duplicateSiblings={
            (selectedCandidate.candidate_email ?? '').trim()
              ? candidates.filter(x =>
                  x.id !== selectedCandidate.id &&
                  (x.candidate_email ?? '').trim().toLowerCase() === (selectedCandidate.candidate_email ?? '').trim().toLowerCase()
                )
              : []
          }
          teamMembers={teamMembers.filter(m => m.invite_accepted)}
          canChangeOwner={
            !!teamMembers.find(m =>
              m.invite_accepted &&
              m.email.toLowerCase() === (session?.user?.email ?? '').toLowerCase() &&
              (m.role === 'owner' || m.role === 'admin')
            )
          }
          onJumpToCandidate={(id) => {
            const nc = candidates.find(x => x.id === id)
            if (nc) setSelectedCandidate(nc)
          }}
          jobs={jobs}
          onClose={() => setSelectedCandidate(null)}
          onStageChange={moveStage}
          onJobChange={changeJob}
          onOwnerChange={(id, userId, uploadedBy) => {
            setCandidates(prev => prev.map(x =>
              x.id === id ? { ...x, user_id: userId, uploaded_by: uploadedBy } : x
            ))
            setSelectedCandidate(prev =>
              prev && prev.id === id ? { ...prev, user_id: userId, uploaded_by: uploadedBy } : prev
            )
          }}
          onRecordSaved={(id, profile) => {
            applyCandidatePatch(id, { candidate_profile: profile })
          }}
          onPhoneSaved={(id, phone) => {
            applyCandidatePatch(id, { candidate_phone: phone })
          }}
          onEdit={() => {
            setEditCandidate(selectedCandidate)
            setSelectedCandidate(null)
          }}
          onSubmissionDetails={() => {
            setSubmissionCandidate(selectedCandidate)
          }}
        />
      )}

      {allocateFor && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3" onClick={e => { if (e.target === e.currentTarget) setAllocateFor(null) }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-extrabold text-slate-900">Submit {allocateFor.candidate_name} to a client / role</p>
              <button type="button" className="text-xs font-bold text-slate-500" onClick={() => setAllocateFor(null)}>Close</button>
            </div>
            <CandidateAllocatePanel
              candidateId={allocateFor.id}
              candidateName={allocateFor.candidate_name}
              candidateEmail={allocateFor.candidate_email}
              defaultJobId={allocateFor.job_posts?.id}
              onChanged={() => { loadData(); setAllocateFor(null) }}
            />
          </div>
        </div>
      )}

      {editCandidate && (
        <EditCandidateModal
          candidate={editCandidate}
          jobs={jobs}
          onClose={() => setEditCandidate(null)}
          onSaved={(updated) => {
            applyCandidatePatch(updated.id, updated as Partial<Candidate>)
          }}
        />
      )}

      {submissionCandidate && (
        <SubmissionDetailsModal
          candidate={submissionCandidate}
          jobs={jobs}
          onClose={() => setSubmissionCandidate(null)}
          onSaved={(updated) => {
            applyCandidatePatch(updated.id, updated as Partial<Candidate>)
          }}
        />
      )}

      <AddCandidateFlow
        open={showNewCandidate}
        onClose={() => { setShowNewCandidate(false); setCandDupWarning(null) }}
        jobs={jobs.map(j => ({ id: j.id, title: j.title, short_id: j.short_id }))}
        onViewCandidate={(id) => router.push(`/dashboard/candidates/${id}`)}
        onCreated={(name) => {
          loadData()
          setWorkspaceBanner(`Candidate saved to your workspace: ${name}`)
        }}
      />

      {/* ── Upgrade Plan Modal ────────────────────────────────────────────── */}
      {upgradePrompt.show && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-0 w-full max-w-md border border-slate-200 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="bg-[#166534] px-5 py-4 text-center">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                <Crown className="w-5 h-5 text-amber-200" />
              </div>
              <h2 className="text-base font-bold text-white">Upgrade your plan</h2>
              <p className="text-sm text-indigo-100 mt-1">{upgradePrompt.message}</p>
              <p className="text-[11px] text-white/85 mt-2 leading-snug px-1">
                In-app card payments are not enabled yet. To subscribe or renew, email our team using the button below—we will confirm your workspace and billing cycle manually.
              </p>
            </div>

            {/* Feature list */}
            <div className="px-5 py-4 bg-white">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-2">What you get with Pro</p>
              <div className="space-y-2.5">
                {[
                  { icon: Sparkles, text: 'Unlimited AI screenings', desc: 'Screen as many resumes as you need' },
                  { icon: Briefcase, text: 'Unlimited job posts', desc: 'Create and manage unlimited openings' },
                  { icon: Mail, text: 'AI compose & social posts', desc: 'Generate content for any platform' },
                  { icon: Shield, text: 'Priority support', desc: 'Get help when you need it most' },
                  { icon: Key, text: 'API access', desc: 'Integrate with your existing tools' },
                ].map(({ icon: Icon, text, desc }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                      <Icon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{text}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button onClick={() => setUpgradePrompt({ show: false, message: '', feature: '' })}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
                Maybe later
              </button>
              <a href="mailto:pasikantishashank24@gmail.com?subject=Upgrade%20to%20Pro%20Plan%20-%20SRP%20SmartRecruit&body=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20account%20to%20the%20Pro%20plan.%0A%0AMy%20Email%3A%20"
                onClick={() => setUpgradePrompt({ show: false, message: '', feature: '' })}
                className="flex-1 py-2.5 rounded-lg bg-[#166534] hover:bg-blue-500 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> Upgrade now
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fill: color, fontSize: size * 0.22, fontWeight: 700 }}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

// ── LightFileUploadZone (for light-background tabs: JD Writer, Boolean) ───────
function LightFileUploadZone({ label, accept, onText, disabled }: {
  label: string; accept: string
  onText: (text: string) => void; disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')

  const parseFile = async (file: File) => {
    setParsing(true); setParseError(''); setFileName('')
    try {
      const d = await parseUploadedFile(file)
      if (d.text) {
        setFileName(file.name)
        onText(d.text)
      } else {
        setParseError(`Failed to parse ${file.name}`)
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Could not read this file — paste the text instead')
    }
    finally { setParsing(false) }
  }

  return (
    <div
      className={`srp-dropzone ${
        dragging ? 'is-drag' :
        parseError ? 'is-err' :
        fileName ? 'is-ok' : ''
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragEnter={e => { e.preventDefault(); setDragging(true) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { e.preventDefault(); setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f) }}
      onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); if (ref.current) ref.current.value = '' }} />
      {parsing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-[#166534] font-bold">
          <Loader2 className="w-5 h-5 animate-spin" /> Parsing file…
        </div>
      ) : parseError ? (
        <>
          <div className="srp-dropzone-icon !bg-red-50 !text-red-600"><AlertCircle className="w-5 h-5" /></div>
          <p className="srp-dropzone-title text-red-800">{parseError}</p>
          <p className="srp-dropzone-sub">Click to try another PDF, DOCX, or TXT</p>
        </>
      ) : fileName ? (
        <>
          <div className="srp-dropzone-icon !bg-emerald-50 !text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <p className="srp-dropzone-title">{fileName}</p>
          <p className="srp-dropzone-sub">Parsed — click to replace file</p>
        </>
      ) : (
        <>
          <div className="srp-dropzone-icon"><Upload className="w-5 h-5" /></div>
          <p className="srp-dropzone-title">{label}</p>
          <p className="srp-dropzone-sub">PDF · DOCX · DOC · TXT — click or drag & drop</p>
        </>
      )}
    </div>
  )
}

// ── FileUploadZone ────────────────────────────────────────────────────────────
function FileUploadZone({ label, accept, multiple, onTexts, disabled }: {
  label: string; accept: string; multiple: boolean
  onTexts: (items: Array<{ text: string; filename: string; file?: File }>) => void; disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [parseError, setParseError] = useState('')

  const parseFiles = async (files: FileList) => {
    setParsing(true); setParseError(''); setNames([])
    const fileArray = multiple
      ? Array.from(files)
      : (files.length > 1 ? Array.from(files) : Array.from(files).slice(0, 1))
    const results: Array<{ text: string; filename: string; file?: File }> = []
    let lastError = ''
    for (const file of fileArray) {
      try {
        const d = await parseUploadedFile(file)
        if (d.text) {
          results.push({ text: d.text, filename: file.name, file })
        } else {
          lastError = `Failed to parse ${file.name}`
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : `Could not read ${file.name}`
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
    <div className={`srp-dropzone ${
      dragging ? 'is-drag' : parseError ? 'is-err' : names.length > 0 ? 'is-ok' : ''
    } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragEnter={e => { e.preventDefault(); setDragging(true) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { e.preventDefault(); setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) parseFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => { if (e.target.files?.length) parseFiles(e.target.files); if (ref.current) ref.current.value = '' }} />
      {parsing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-[#166534] font-bold">
          <Loader2 className="w-5 h-5 animate-spin" /> Parsing…
        </div>
      ) : parseError ? (
        <>
          <div className="srp-dropzone-icon !bg-red-50 !text-red-600"><AlertCircle className="w-5 h-5" /></div>
          <p className="srp-dropzone-title text-red-800">{parseError}</p>
          <p className="srp-dropzone-sub">Click to try again</p>
        </>
      ) : names.length > 0 ? (
        <>
          <div className="srp-dropzone-icon !bg-emerald-50 !text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <p className="srp-dropzone-title">{names.length} file{names.length > 1 ? 's' : ''} loaded</p>
          {names.slice(0, 3).map(n => <p key={n} className="srp-dropzone-sub truncate max-w-full">{n}</p>)}
          {names.length > 3 && <p className="srp-dropzone-sub">+{names.length - 3} more</p>}
        </>
      ) : (
        <>
          <div className="srp-dropzone-icon"><Upload className="w-5 h-5" /></div>
          <p className="srp-dropzone-title">{label}</p>
          <p className="srp-dropzone-sub">Click or drag & drop — PDF · DOCX · TXT</p>
        </>
      )}
    </div>
  )
}

// ── ScreenResultCard ──────────────────────────────────────────────────────────
function ScreenResultCard({
  result: r,
  jobPostId,
  originalFile,
  onSaved,
  onDiscard,
  defaultOpen = true,
}: {
  result: ScreenResult
  jobPostId?: string
  originalFile?: File
  onSaved: (updated: ScreenResult) => void
  onDiscard: () => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [screenedAt] = useState(() => {
    try {
      return fmtDate(r.screened_at ?? new Date().toISOString(), true)
    } catch {
      return new Date().toISOString()
    }
  })
  const isDraft = Boolean(r.draft || (!r.db_id && !r.persisted))
  const score = Math.round(Number(r.score) || 0)
  const jdMatch = r.jd_match?.match_percent
  const briefLine = (() => {
    const summary = typeof r.executive_summary === 'string' ? r.executive_summary.trim() : ''
    if (summary) return summary.length > 160 ? `${summary.slice(0, 160)}…` : summary
    const matched = Array.isArray(r.jd_match?.matching_skills) ? r.jd_match!.matching_skills!.slice(0, 3) : []
    const missing = Array.isArray(r.jd_match?.missing_skills) ? r.jd_match!.missing_skills!.slice(0, 2) : []
    if (matched.length || missing.length) {
      const m = matched.map(x => (typeof x === 'string' ? x : String((x as { name?: string })?.name ?? ''))).filter(Boolean)
      const g = missing.map(x => (typeof x === 'string' ? x : String((x as { name?: string })?.name ?? ''))).filter(Boolean)
      return `${m.length ? `Strong: ${m.join(', ')}` : 'Limited matches'}${g.length ? ` · Gaps: ${g.join(', ')}` : ''}`
    }
    return r.decision ? `Decision: ${r.decision}` : 'Open details for the full AI audit.'
  })()

  const saveCandidate = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const fd = new FormData()
      fd.append('result', JSON.stringify(r))
      fd.append('raw_text', r.raw_text || '')
      fd.append('filename', r.filename || originalFile?.name || 'resume.txt')
      if (jobPostId) fd.append('job_post_id', jobPostId)
      if (originalFile) fd.append('file', originalFile)
      const res = await fetch('/api/screen/save', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || 'Could not save candidate')
        return
      }
      onSaved((data.result as ScreenResult) ?? { ...r, db_id: data.db_id, short_id: data.short_id, draft: false, persisted: true })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 p-4 border-b border-gray-100 bg-slate-50/60">
        <div className={`flex-shrink-0 w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center ${
          score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
        }`}>
          <span className={`text-lg font-black leading-none ${
            score >= 70 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-700'
          }`}>{score}</span>
          <span className="text-[8px] font-bold text-gray-400 uppercase">score</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900">{typeof r.name === 'string' && r.name.trim() ? r.name : 'Unknown Candidate'}</h3>
            {r.short_id && <ShortIdBadge id={r.short_id} />}
            {r.decision && (
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                String(r.decision).toLowerCase().includes('reject') ? 'bg-red-50 text-red-800 border-red-200'
                  : String(r.decision).toLowerCase().includes('hold') ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>{String(r.decision)}</span>
            )}
            {jdMatch != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">JD {Math.round(Number(jdMatch))}%</span>
            )}
            {isDraft ? (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Draft</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Saved</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {[r.email, r.contact_number, r.current_company].map(v => (typeof v === 'string' ? v : '')).filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-slate-600 mt-1.5 leading-snug line-clamp-2">{briefLine}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={saveCandidate}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Candidate'}
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                Discard
              </button>
            </>
          )}
          {!isDraft && r.db_id && (
            <span className="text-[10px] text-emerald-700 font-medium px-2">Updated screening</span>
          )}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${open ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
          >
            {open ? 'Collapse' : 'View Details'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {saveError && (
        <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{saveError}</div>
      )}
      {open && (
        <ScreeningReportErrorBoundary fallbackTitle="Screening details crashed — payload was unexpected">
          <ScreeningReportView data={r} variant="card" showHeader={false} screenedAtLabel={screenedAt} briefFirst />
        </ScreeningReportErrorBoundary>
      )}
    </div>
  )
}

// ── CandidateScreeningDetail — shared report inside candidate modal / C360 ──
function CandidateScreeningDetail({ data: r }: { data: ScreenResult }) {
  return (
    <ScreeningReportErrorBoundary>
      <ScreeningReportView data={r} variant="compact" showHeader briefFirst={false} />
    </ScreeningReportErrorBoundary>
  )
}

// KanbanCard removed in Phase 3.2 (Pipeline Kanban deleted)

// ── JobDetailDrawer ───────────────────────────────────────────────────────────
function JobDetailDrawer({ job, candidates, jobs, onClose, onOpenCandidate, onStageChange, onJobStatusChange, onOpenPosts }: {
  job: Job
  candidates: Candidate[]
  jobs: Job[]
  onClose: () => void
  onOpenCandidate: (c: Candidate) => void
  onStageChange: (id: string, stage: string) => void
  onJobStatusChange: (jobId: string, status: string) => Promise<void>
  onOpenPosts: (job: Job) => void
}) {
  const [savingStatus, setSavingStatus] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const stageSummary = PIPELINE_STAGES.map(s => ({
    ...s,
    count: candidates.filter(c => c.pipeline_stage === s.key).length,
  }))
  const total = candidates.length

  const handleStatusChange = async (newStatus: string) => {
    setSavingStatus(true)
    try { await onJobStatusChange(job.id, newStatus) } finally { setSavingStatus(false) }
  }

  const handleInlineStage = async (candId: string, stage: string) => {
    setAssigningId(candId)
    await onStageChange(candId, stage)
    setAssigningId(null)
  }

  return (
    <div className="drawer-overlay" style={{ zIndex: 45 }} onClick={onClose}>
      <div className="drawer-panel flex flex-col bg-white" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="flex items-start gap-4 p-6 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
          <div className="w-11 h-11 rounded-xl bg-[#166534] flex-shrink-0 flex items-center justify-center shadow-md">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} />
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{job.title}</h2>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{[job.company, job.location, job.type].filter(Boolean).join(' · ')}</p>
            <div className="field-grid mt-3">
              <div className="field-grid-item">
                <span className="field-label">Status</span>
                <select
                  value={job.status}
                  disabled={savingStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border appearance-none cursor-pointer focus:outline-none ${
                    job.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                    job.status === 'closed' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                  title="Change job status">
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="field-grid-item">
                <span className="field-label">Posted</span>
                <span className="field-value text-sm">{fmtDate(job.created_at)}</span>
              </div>
              {job.location && (
                <div className="field-grid-item">
                  <span className="field-label">Location</span>
                  <span className="field-value text-sm">{job.location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onOpenPosts(job)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-100 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> JD / Posts
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Pipeline Funnel ── */}
        <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pipeline · {total} candidate{total !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-7 gap-1.5">
            {stageSummary.map(s => (
              <div key={s.key} className={`rounded-xl p-2 text-center border ${STAGE_LIGHT[s.key]?.bg ?? 'bg-slate-50'} ${STAGE_LIGHT[s.key]?.border ?? 'border-slate-200'}`}>
                <p className={`text-base font-bold ${STAGE_LIGHT[s.key]?.text ?? 'text-slate-600'}`}>{s.count}</p>
                <p className={`text-[10px] font-semibold ${STAGE_LIGHT[s.key]?.text ?? 'text-slate-500'} truncate`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Description preview ── */}
        {job.description && (
          <div className="flex-shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Job description</p>
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{job.description}</p>
          </div>
        )}

        {/* ── Candidate List ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Candidates for this job</p>
            <span className="text-xs text-slate-400">{total} total</span>
          </div>
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <Users className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500 mb-1">No candidates linked to this job yet.</p>
              <p className="text-xs text-slate-400">Upload a CV on the AI Screen tab and select this job, or assign existing candidates via their profile.</p>
            </div>
          ) : (
            <ScrollableTable>
              <table className="ent-table w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Candidate</th>
                    <th>Stage</th>
                    <th>Match</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <tr key={c.id}
                      onClick={() => onOpenCandidate(c)}
                      className={`cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="whitespace-nowrap">
                        <ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} />
                      </td>
                      <td className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#166534] flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
                            {c.candidate_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{c.candidate_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{c.candidate_email}</p>
                            {c.candidate_phone && <p className="text-[10px] text-slate-400">{c.candidate_phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {assigningId === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          : <select
                              value={c.pipeline_stage}
                              onChange={e => handleInlineStage(c.id, e.target.value)}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full border appearance-none cursor-pointer focus:outline-none ${STAGE_LIGHT[c.pipeline_stage]?.bg ?? 'bg-slate-100'} ${STAGE_LIGHT[c.pipeline_stage]?.text ?? 'text-slate-600'} ${STAGE_LIGHT[c.pipeline_stage]?.border ?? 'border-slate-200'}`}>
                              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        }
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <MatchBadge category={c.match_category} score={c.ai_score} variant="light" />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-400">{fmtDate(c.created_at)}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button onClick={e => { e.stopPropagation(); onOpenCandidate(c) }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CandidateDetailModal ──────────────────────────────────────────────────────
const EMPTY_RECORD: Record<string, string> = {
  // ── Employment
  current_company: '',
  current_title: '',
  current_location: '',
  preferred_location: '',
  // ── Experience
  total_experience: '',
  relevant_experience: '',
  // ── Compensation
  current_salary: '',
  expected_salary: '',
  notice_period: '',
  // ── Compliance / visa
  nationality: '',
  work_authorization: '',
  visa_type: '',
  visa_expiry: '',
  // ── Government / legal IDs
  nric: '',
  india_pan: '',
  india_aadhaar_last4: '',
  passport_number: '',
  pf_number: '',
  id_document_type: '',
  id_document_reference: '',
  // ── Commercial
  hire_type: '',
  client_name: '',
  applying_for: '',
  lifecycle_status: '',
  // ── Notes
  notes: '',
}

function AiFitScoreInline({ resumeId }: { resumeId: string }) {
  const [scores, setScores] = useState<AiFitScores | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/candidates/${resumeId}/ai-fit`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setScores(d.scores ?? null) })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [resumeId])
  if (!scores) return null
  return (
    <div className="mt-3">
      <AiFitScoreCard scores={scores} compact />
    </div>
  )
}

/** Resume tab — probes file availability before iframe preview. */
function ResumeFilePanel({ candidate: c }: { candidate: Candidate }) {
  const path = c.resume_original_path ?? null
  const isPdf = !!path && path.toLowerCase().endsWith('.pdf')
  const [probe, setProbe] = useState<'idle' | 'ok' | 'missing'>('idle')

  useEffect(() => {
    if (!path) return
    let cancelled = false
    fetch(`/api/candidates/${c.id}/resume-file`, { method: 'HEAD' })
      .then(res => {
        if (cancelled) return
        setProbe(res.ok ? 'ok' : 'missing')
      })
      .catch(() => { if (!cancelled) setProbe('missing') })
    return () => { cancelled = true }
  }, [c.id, path])

  const fileState: 'checking' | 'ok' | 'missing' | 'none' =
    !path ? 'none' : probe === 'idle' ? 'checking' : probe

  return (
    <div className="p-5 sm:p-6 space-y-4 bg-slate-50/40">
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.02] p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">Original file</h3>
        {fileState === 'none' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700">No original file stored</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {c.file_name
                  ? `"${c.file_name}" was imported without file storage. Re-upload a resume to enable download and PDF preview.`
                  : 'Upload a resume file on this candidate to enable download and preview.'}
              </p>
            </div>
          </div>
        )}
        {fileState === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Checking file…
          </div>
        )}
        {fileState === 'missing' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">File path on record, but file is missing</p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                The database references a resume file that could not be found in storage. Re-upload the resume to restore preview and download.
              </p>
            </div>
          </div>
        )}
        {fileState === 'ok' && path && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-800 flex-1 truncate">{c.file_name || 'Resume file'}</span>
              <a
                href={`/api/candidates/${c.id}/resume-file`}
                download={c.file_name || 'resume'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              {isPdf && (
                <a
                  href={`/api/candidates/${c.id}/resume-file?inline=1`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                </a>
              )}
            </div>
            {isPdf ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <iframe
                  title="Original resume PDF"
                  className="w-full bg-white"
                  style={{ height: '65vh', minHeight: '480px' }}
                  src={`/api/candidates/${c.id}/resume-file?inline=1`}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Preview is available for PDF files. Use Download to open this {path.split('.').pop()?.toUpperCase() || 'document'} locally.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.02] p-4 sm:p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Extracted text (searchable)</p>
        {c.raw_text ? (
          <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-200 font-sans">
            {c.raw_text.replace(/[□☐■▪◦◆►▸]/g, '•')}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 rounded-xl border border-slate-100 bg-slate-50">
            <FileText className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No resume text stored</p>
            <p className="text-xs mt-1 text-slate-400">Run AI Screening with a CV file to extract and save text</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateDetailModal({ candidate: c, duplicateSiblings, teamMembers = [], canChangeOwner = false, jobs, onClose, onJumpToCandidate, onStageChange, onJobChange, onOwnerChange, onRecordSaved, onPhoneSaved, onEdit, onSubmissionDetails }: {
  candidate: Candidate
  /** Other resume rows in this workspace with the same email (tenant-scoped). */
  duplicateSiblings: Candidate[]
  teamMembers?: { user_id: string; name: string | null; email: string; role: string }[]
  canChangeOwner?: boolean
  jobs: Job[]
  onClose: () => void
  /** Switch modal to another candidate row in this workspace. */
  onJumpToCandidate?: (id: string) => void
  onStageChange: (id: string, stage: string) => void
  onJobChange: (id: string, jobId: string) => void
  onOwnerChange?: (id: string, userId: string, uploadedBy: { name: string | null; email: string | null }) => void
  onRecordSaved: (id: string, profile: Record<string, string | null>) => void
  onPhoneSaved: (id: string, phone: string | null) => void
  onEdit?: () => void
  onSubmissionDetails?: () => void
}) {
  const [tab, setTab] = useState<import('@/components/candidates/Candidate360View').Candidate360Tab>('profile')
  const [recordDraft, setRecordDraft] = useState(EMPTY_RECORD)
  const [recordSaving, setRecordSaving] = useState(false)
  const [recordMsg, setRecordMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { checks, requiredMissing, recommendedMissing, dossierPercent, warnRecordIds } = getCandidateDossierStatus(c)
  const recWarn = (key: keyof typeof recordDraft) => warnRecordIds.has(key as string)

  const structuredAi =
    c.ai_screening_data &&
    typeof c.ai_screening_data === 'object' &&
    !Array.isArray(c.ai_screening_data) &&
    Object.keys(c.ai_screening_data as object).length > 0 &&
    !('error' in (c.ai_screening_data as object))
  const hasAiData = !!(structuredAi || (c.ai_summary && c.ai_summary.trim()))

  useEffect(() => {
    const p = c.candidate_profile ?? {}
    setRecordDraft({
      current_company: String(p.current_company ?? ''),
      current_title: String(p.current_title ?? ''),
      current_location: String(p.current_location ?? ''),
      preferred_location: String(p.preferred_location ?? ''),
      total_experience: String(p.total_experience ?? ''),
      relevant_experience: String(p.relevant_experience ?? ''),
      current_salary: String(p.current_salary ?? ''),
      expected_salary: String(p.expected_salary ?? ''),
      notice_period: String(p.notice_period ?? ''),
      nationality: String(p.nationality ?? ''),
      work_authorization: String(p.work_authorization ?? ''),
      visa_type: String(p.visa_type ?? ''),
      visa_expiry: String(p.visa_expiry ?? ''),
      nric: String(p.nric ?? ''),
      india_pan: String(p.india_pan ?? ''),
      india_aadhaar_last4: String(p.india_aadhaar_last4 ?? ''),
      passport_number: String(p.passport_number ?? ''),
      pf_number: String(p.pf_number ?? ''),
      id_document_type: String(p.id_document_type ?? ''),
      id_document_reference: String(p.id_document_reference ?? ''),
      hire_type: String(p.hire_type ?? ''),
      client_name: String(p.client_name ?? ''),
      applying_for: String(p.applying_for ?? ''),
      lifecycle_status: String(p.lifecycle_status ?? ''),
      notes: String(p.notes ?? ''),
    })
    setRecordMsg(null)
  }, [c.id, c.candidate_profile])

  useEffect(() => {
    setPhoneDraft(c.candidate_phone ?? '')
    setPhoneMsg(null)
  }, [c.id, c.candidate_phone])

  const savePhone = async () => {
    setPhoneSaving(true)
    setPhoneMsg(null)
    try {
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_phone: phoneDraft.trim() || null }),
      })
      let data: { error?: string; candidate?: { candidate_phone?: string | null } } = {}
      try { data = await res.json() } catch { /* ignore */ }
      if (!res.ok) {
        setPhoneMsg({ ok: false, text: data.error ?? 'Could not save phone' })
        return
      }
      const saved = data.candidate?.candidate_phone ?? (phoneDraft.trim() || null)
      onPhoneSaved(c.id, saved)
      setPhoneMsg({ ok: true, text: 'Phone updated.' })
    } finally {
      setPhoneSaving(false)
    }
  }

  const saveRecord = async () => {
    setRecordSaving(true)
    setRecordMsg(null)
    try {
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_profile: recordDraft }),
      })
      let data: { error?: string; candidate?: { candidate_profile?: Record<string, string | null> } } = {}
      try { data = await res.json() } catch { /* ignore */ }
      if (!res.ok) {
        setRecordMsg({ ok: false, text: data.error ?? 'Save failed' })
        return
      }
      const prof = data.candidate?.candidate_profile ?? (recordDraft as Record<string, string | null>)
      onRecordSaved(c.id, prof)
      setRecordMsg({ ok: true, text: 'Saved to this workspace (tenant-scoped).' })
    } finally {
      setRecordSaving(false)
    }
  }

  const recField = (key: keyof typeof recordDraft, label: string, ph: string, type: 'text' | 'textarea' = 'text', warn = false) => {
    const border = warn ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-200'
    return (
      <div key={key}>
        <label className="field-label flex items-center gap-1">
          {label}
          {warn && <span className="text-amber-600 font-bold normal-case" title="Missing — recommended for a complete dossier">!</span>}
        </label>
        {type === 'textarea' ? (
          <textarea value={recordDraft[key]} onChange={e => setRecordDraft(d => ({ ...d, [key]: e.target.value }))}
            rows={2} placeholder={ph}
            className={`w-full px-3 py-2 rounded-lg bg-white border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none ${border}`} />
        ) : (
          <input value={recordDraft[key]} onChange={e => setRecordDraft(d => ({ ...d, [key]: e.target.value }))}
            type="text" placeholder={ph}
            className={`w-full px-3 py-2 rounded-lg bg-white border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${border}`} />
        )}
      </div>
    )
  }

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer-panel" style={{ maxWidth: '720px' }}>

        {duplicateSiblings.length > 0 && (
          <div className="mx-6 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {duplicateSiblings.length + 1} workspace record{(duplicateSiblings.length + 1) !== 1 ? 's' : ''} share this email
            </p>
            <p className="text-xs text-amber-900/85 mt-1 leading-relaxed">
              Shown only inside this tenant. Other workspaces never see or merge these rows.
            </p>
            <ul className="mt-2 space-y-1.5 text-xs border-t border-amber-200/80 pt-2">
              <li className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-800">
                <span className="font-mono font-semibold">{c.short_id ?? c.id.slice(0, 8)}</span>
                <span className="text-slate-400">·</span>
                <span>{formatUploader(c.uploaded_by)}</span>
                <span className="text-slate-400">·</span>
                <span>{fmtDate(c.created_at)}</span>
                <span className="text-slate-400">·</span>
                <span className="capitalize">{c.pipeline_stage}</span>
                <span className="text-slate-400">·</span>
                <span className="capitalize">{c.status}</span>
              </li>
              {duplicateSiblings.map(s => (
                <li key={s.id} className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-800">
                  {onJumpToCandidate ? (
                    <button type="button" className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
                      onClick={() => onJumpToCandidate(s.id)}>
                      {s.short_id ?? s.id.slice(0, 8)}
                    </button>
                  ) : (
                    <span className="font-mono font-semibold">{s.short_id ?? s.id.slice(0, 8)}</span>
                  )}
                  <span className="text-slate-400">·</span>
                  <span>{formatUploader(s.uploaded_by)}</span>
                  <span className="text-slate-400">·</span>
                  <span>{fmtDate(s.created_at)}</span>
                  <span className="text-slate-400">·</span>
                  <span className="capitalize">{s.pipeline_stage}</span>
                  <span className="text-slate-400">·</span>
                  <span className="capitalize">{s.status}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-amber-800/80 mt-2">Use another row&apos;s ID above to open that record, or pick it from the Candidates list.</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-slate-200 bg-slate-50/80">
          <div className="w-12 h-12 rounded-full bg-[#166534] flex-shrink-0 flex items-center justify-center text-lg font-bold text-white shadow-md">
            {c.candidate_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} />
              <h2 className="text-xl font-bold text-slate-900">{c.candidate_name}</h2>
              <a
                href={`/dashboard/candidates/${c.id}`}
                className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Open full page
              </a>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{c.candidate_email}</p>
            {c.candidate_phone && <p className="text-sm text-slate-500">{c.candidate_phone}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {hasAiData
                ? <button onClick={() => setTab('ai')} title="Click to view full AI screening report" className="cursor-pointer hover:opacity-90 transition-opacity">
                    <MatchBadge category={c.match_category} score={c.ai_score} variant="light" />
                  </button>
                : <MatchBadge category={c.match_category} score={c.ai_score} variant="light" />
              }
              <StagePill stage={c.pipeline_stage} variant="light" />
              {c.created_at && (
                <span className="text-xs text-slate-500 font-mono">
                  Added {fmtDate(c.created_at)}
                  {c.uploaded_by ? <> · by {formatUploader(c.uploaded_by)}</> : null}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {onEdit && (
                <button type="button" onClick={onEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
                  <Pencil className="w-3.5 h-3.5" /> Edit candidate
                </button>
              )}
              {onSubmissionDetails && (
                <button type="button" onClick={onSubmissionDetails}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50">
                  Submission details
                </button>
              )}
            </div>
            {canChangeOwner && teamMembers.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Profile owner</label>
                <select
                  value={c.user_id ?? ''}
                  onChange={async e => {
                    const userId = e.target.value
                    if (!userId || userId === c.user_id) return
                    const member = teamMembers.find(m => m.user_id === userId)
                    const res = await fetch(`/api/candidates/${c.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: userId }),
                    })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}))
                      alert(err.error ?? 'Ownership change failed')
                      return
                    }
                    onOwnerChange?.(c.id, userId, {
                      name: member?.name ?? null,
                      email: member?.email ?? null,
                    })
                  }}
                  className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
                  title="Reassign within this workspace only — never across tenants"
                >
                  <option value="" disabled>Select workspace member…</option>
                  {teamMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {(m.name || m.email)} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors mt-1 rounded-lg p-1 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dossier completeness (missing-field hints) */}
        <div className="px-6 pb-4 pt-4 space-y-3 bg-white">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-mono font-semibold text-slate-800">Dossier {dossierPercent}%</span>
            <span className="text-slate-300">·</span>
            <span>Required fields marked * in the summary below; amber = recommended for handoff.</span>
          </div>
          {requiredMissing.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold flex items-center gap-2 text-red-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> Missing required details
              </p>
              <ul className="mt-2 list-disc list-inside text-xs text-red-900/90 space-y-0.5">
                {requiredMissing.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}
          {requiredMissing.length === 0 && recommendedMissing.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> Incomplete dossier — add recommended details
              </p>
              <p className="text-xs text-amber-900/85 mt-1 mb-2">Recruiters get clearer handoff when these are filled (phone, job link, ATS record, resume text, compliance IDs).</p>
              <ul className="list-disc list-inside text-xs text-amber-950/95 space-y-0.5 max-h-28 overflow-y-auto">
                {recommendedMissing.map(m => <li key={m}>{m}</li>)}
              </ul>
              <button type="button" onClick={() => setTab('record')} className="mt-3 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950">
                Open ATS record tab →
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Candidate360TabBar
          tab={tab}
          onTabChange={setTab}
          hasAiData={hasAiData}
          recordWarn={[...warnRecordIds].some(id => (Object.keys(EMPTY_RECORD) as string[]).includes(id))}
        />

        {tab === 'profile' && (
          <div className="p-5 space-y-5 bg-white">

            {/* ── Quick Info Grid ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Candidate Overview</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Email ID', value: c.candidate_email, color: 'text-indigo-700' },
                  { label: 'Contact Number', value: c.candidate_phone || null },
                  { label: 'Current Company', value: c.candidate_profile?.current_company || null },
                  { label: 'Current Title', value: c.candidate_profile?.current_title || null },
                  { label: 'Current Location', value: c.candidate_profile?.current_location || null },
                  { label: 'Preferred Location', value: c.candidate_profile?.preferred_location || null },
                  { label: 'Total Experience', value: c.candidate_profile?.total_experience || null },
                  { label: 'Relevant Experience', value: c.candidate_profile?.relevant_experience || null },
                  { label: 'Nationality', value: c.candidate_profile?.nationality || null },
                  { label: 'NRIC', value: c.candidate_profile?.nric || (String(c.candidate_profile?.id_document_type ?? '').toLowerCase().includes('nric') ? c.candidate_profile?.id_document_reference : null) || null },
                  { label: 'Visa Type', value: c.candidate_profile?.visa_type || null },
                  { label: 'Visa Validity', value: c.candidate_profile?.visa_expiry || null },
                  { label: 'Work Authorization', value: c.candidate_profile?.work_authorization || null },
                  { label: 'Client', value: c.candidate_profile?.client_name || null },
                  { label: 'Hire Type', value: c.candidate_profile?.hire_type || null },
                  { label: 'Applying For', value: c.candidate_profile?.applying_for || null },
                  { label: 'Lifecycle', value: c.candidate_profile?.lifecycle_status ? formatLifecycle(c.candidate_profile.lifecycle_status) : null },
                  { label: 'Current Salary', value: c.candidate_profile?.current_salary || null },
                  { label: 'Expected Salary', value: c.candidate_profile?.expected_salary || null },
                  { label: 'Notice Period', value: c.candidate_profile?.notice_period || null },
                  { label: 'PAN Number', value: c.candidate_profile?.india_pan || null },
                  { label: 'Aadhaar (masked)', value: c.candidate_profile?.india_aadhaar_last4 || null },
                  { label: 'Passport Number', value: c.candidate_profile?.passport_number || null },
                  { label: 'PF Number', value: c.candidate_profile?.pf_number || null },
                  { label: 'Other ID Type', value: c.candidate_profile?.id_document_type ? `${c.candidate_profile.id_document_type}${c.candidate_profile.id_document_reference ? ': ' + c.candidate_profile.id_document_reference : ''}` : null },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className={`text-[13px] font-medium break-all leading-snug ${color ?? (value ? 'text-slate-800' : 'text-slate-300')}`}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>
              {(c.candidate_profile?.notes) && (
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Internal Notes</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-line">{c.candidate_profile.notes}</p>
                </div>
              )}
            </div>

            {/* ── Edit phone (stored on row, not in profile JSONB) ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Update Phone</p>
              <div className={`flex gap-2 rounded-lg border p-2 ${warnRecordIds.has('candidate_phone') ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <input value={phoneDraft} onChange={e => setPhoneDraft(e.target.value)}
                  type="tel" placeholder="+91 … or local number"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                <button type="button" onClick={savePhone} disabled={phoneSaving}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm whitespace-nowrap">
                  {phoneSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {phoneMsg && <p className={`text-xs ${phoneMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{phoneMsg.text}</p>}
            </div>

            {/* ── Pipeline Stage ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pipeline Stage</p>
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_STAGES.map(s => (
                  <button key={s.key} onClick={() => onStageChange(c.id, s.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      c.pipeline_stage === s.key
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Assign to Job ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Assigned Job</p>
              <select value={c.job_posts?.id ?? ''}
                onChange={e => onJobChange(c.id, e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-white border text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${
                  warnRecordIds.has('job_post') ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-200'
                }`}>
                <option value="">— No Job Assigned —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company} ({j.short_id})</option>)}
              </select>
            </div>

            {/* ── AI Skills ── */}
            {(c.ai_skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">AI-Extracted Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.ai_skills.map((s, i) => {
                    const label = typeof s === 'string' ? s : (s && typeof s === 'object' && 'name' in (s as object) ? String((s as { name?: unknown }).name ?? '') : String(s ?? ''))
                    if (!label.trim()) return null
                    return (
                    <span key={`${label}-${i}`} className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 text-xs font-medium">{label}</span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── AI Summary ── */}
            {hasAiData && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">AI Assessment</p>
                  <button onClick={() => setTab('ai')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Full report →</button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-200">{c.ai_summary || 'AI screening data available — click "Full report" to see details.'}</p>
                <AiFitScoreInline resumeId={c.id} />
              </div>
            )}

            {/* ── Meta ── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="font-mono">ID: {c.short_id ?? c.id.slice(0, 8)}</span>
              <span>Added: {fmtDate(c.created_at)}</span>
              {c.source_type && <span className="capitalize bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">via {c.source_type.replace('_', ' ')}</span>}
              {c.file_name && <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-slate-400" />{c.file_name}</span>}
              {c.last_contacted_at && <span>Last contacted: {fmtDate(c.last_contacted_at)}</span>}
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
              To edit compensation, visa, notice, and IDs — switch to the <button type="button" onClick={() => setTab('record')} className="font-semibold underline underline-offset-2">ATS record tab</button>.
            </div>
          </div>
        )}

        {tab === 'record' && (
          <div className="p-5 space-y-5 bg-white">
            <p className="text-xs text-slate-500 leading-relaxed">
              Recruiter-maintained details (not inferred from CV). Visible only to your workspace. Prefer masked/last-4 digits for government IDs per data policy.
            </p>

            {/* ── Employment ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Employment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recField('current_company', 'Current / Previous Employer', 'e.g. Acme Ltd', 'text', recWarn('current_company'))}
                {recField('current_title', 'Current Job Title', 'e.g. Senior Engineer', 'text', recWarn('current_title'))}
                {recField('current_location', 'Current Location', 'City, country', 'text', recWarn('current_location'))}
                {recField('preferred_location', 'Preferred Location', 'City or "Open to relocation"', 'text', false)}
              </div>
            </div>

            {/* ── Experience ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Experience</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recField('total_experience', 'Total Experience', 'e.g. 8 years', 'text', false)}
                {recField('relevant_experience', 'Relevant Experience', 'e.g. 5 years in React', 'text', false)}
              </div>
            </div>

            {/* ── Compensation & Availability ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Compensation &amp; Availability</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recField('current_salary', 'Current Salary', 'e.g. 18 LPA INR or 5,000 MYR/mo', 'text', recWarn('current_salary' as keyof typeof recordDraft))}
                {recField('expected_salary', 'Expected Salary', 'e.g. 24–28 LPA INR', 'text', recWarn('salary_expectation' as keyof typeof recordDraft))}
                {recField('notice_period', 'Notice Period', 'e.g. 60 days', 'text', recWarn('notice_period'))}
              </div>
            </div>

            {/* ── Compliance / Visa ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nationality &amp; Visa</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recField('nationality', 'Nationality / Citizenship', '', 'text', recWarn('nationality'))}
                {recField('work_authorization', 'Work Authorization', 'e.g. Citizen, PR, EP holder', 'text', recWarn('work_authorization'))}
                {recField('visa_type', 'Visa Type', 'e.g. Employment Pass, H1-B, Work Permit', 'text', recWarn('visa_type'))}
                {recField('visa_expiry', 'Visa Validity', 'YYYY-MM-DD or as on passport', 'text', recWarn('visa_expiry'))}
              </div>
            </div>

            {/* ── Government / Legal IDs ── */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Government / Legal IDs <span className="text-slate-300 font-normal normal-case">(workspace only — use masked values)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recField('nric', 'NRIC (Malaysian)', '901231-10-5678', 'text', recWarn('nric'))}
                {recField('passport_number', 'Passport Number', 'Masked or reference', 'text', false)}
                {recField('india_pan', 'PAN Number (India)', 'e.g. ABCDE1234F', 'text', recWarn('india_pan'))}
                {recField('india_aadhaar_last4', 'Aadhaar (last 4 / masked)', 'Prefer last 4 digits per policy', 'text', recWarn('india_aadhaar_last4'))}
                {recField('pf_number', 'PF / EPF Number', 'e.g. MH/12345/6789', 'text', false)}
                {recField('id_document_type', 'Other ID Type', 'SSN last-4, Driver License…', 'text', false)}
                {recField('id_document_reference', 'Other ID Reference', 'Masked or reference as per policy', 'text', false)}
                {recField('client_name', 'Client', '', 'text', false)}
                {recField('hire_type', 'Hire Type', 'permanent / contract / …', 'text', false)}
                {recField('applying_for', 'Applying For', '', 'text', false)}
                {recField('lifecycle_status', 'Lifecycle Status', 'e.g. submitted', 'text', false)}
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Notes</p>
              {recField('notes', '', 'References, background check status, interview notes…', 'textarea')}
            </div>

            {recordMsg && (
              <p className={`text-sm ${recordMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{recordMsg.text}</p>
            )}
            <button type="button" onClick={saveRecord} disabled={recordSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm transition-colors">
              {recordSaving ? 'Saving…' : 'Save ATS Record'}
            </button>
          </div>
        )}

        {tab === 'ai' && (
          <div className="p-6 bg-white">
            {structuredAi
              ? <CandidateScreeningDetail data={c.ai_screening_data as ScreenResult} />
              : c.ai_summary
                ? <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Summary</p>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-200">{c.ai_summary}</p>
                    {(c.ai_skills?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extracted Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.ai_skills.map((s, i) => {
                            const label = typeof s === 'string' ? s : (s && typeof s === 'object' && 'name' in (s as object) ? String((s as { name?: unknown }).name ?? '') : String(s ?? ''))
                            if (!label.trim()) return null
                            return (
                            <span key={`${label}-${i}`} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 text-xs">{label}</span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-4 italic">Structured screening was not stored for this candidate. Re-run AI screening to capture the full report.</p>
                  </div>
                : <p className="text-sm text-slate-500">No AI screening data available for this candidate.</p>
            }
          </div>
        )}

        {tab === 'resume' && (
          <ResumeFilePanel candidate={c} />
        )}

        {isCandidate360PanelTab(tab) && (
          <Candidate360Panels
            candidateId={c.id}
            tab={tab}
            notes={c.candidate_profile?.notes}
            followUpNotes={c.candidate_profile?.follow_up_notes}
            internalComments={c.candidate_profile?.internal_comments}
            reviewerNotes={c.reviewer_notes}
            onNotesSaved={(profile) => onRecordSaved(c.id, profile)}
          />
        )}
      </div>
    </div>
  )
}
