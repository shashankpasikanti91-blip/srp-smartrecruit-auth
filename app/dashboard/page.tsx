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
  Key, Pencil, Eye, EyeOff, Link2, Trash2, ToggleLeft, ToggleRight, ExternalLink, Info
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Job {
  id: string; short_id: string; title: string; company: string
  location: string; type: string; status: string; applications_count: number
  description?: string; requirements?: string
  salary_min?: number | null; salary_max?: number | null; currency?: string
  tags?: string[]
  created_at: string
  updated_at?: string
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
  reviewer_notes?: string | null
  source_type?: string | null
  job_posts: { id: string; short_id: string; title: string; company: string } | null
  created_at: string
  updated_at?: string
  last_contacted_at?: string | null
}

interface StageCounts { [stage: string]: number }

interface ScreenResult {
  name: string; email: string; contact_number?: string; current_company?: string
  score: number; decision: string
  // ── New Senior Audit AI fields (v2 schema) ──
  classification?: 'STRONG' | 'KAV' | 'REJECT'
  recommendation?: 'Hire' | 'Hold' | 'Reject'
  executive_summary?: string
  experience_audit?: {
    claimed_years?: number; calculated_years?: number
    difference_years?: number; verdict?: string
  }
  gap_analysis?: {
    total_missing_months?: number
    gaps?: Array<{ from?: string; to?: string; months?: number; reason?: string }>
  }
  jd_match?: {
    match_percent?: number; matching_skills?: string[]; missing_skills?: string[]
  }
  skill_authenticity?: { verified?: string[]; unverified?: string[]; outdated?: string[] }
  red_flags?: string[]
  required_actions?: string[]
  // ── Legacy evaluation block (v1 schema — kept for backward compat) ──
  evaluation?: {
    candidate_strengths?: string[]; candidate_weaknesses?: string[]
    low_or_missing_match_skills?: string[]; high_match_skills?: string[]
    medium_match_skills?: string[]; risk_level?: string; risk_explanation?: string
    justification?: string; overall_fit_rating?: number
    strengths?: string[]; weaknesses?: string[]; missing_skills?: string[]
  }
  // set by server after DB insert
  db_id?: string; short_id?: string
  candidate_id?: string
  screened_at?: string
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

// Light variants for white-bg contexts (candidates table, job rows etc.)
const STAGE_LIGHT: Record<string, { bg: string; text: string; border: string }> = {
  sourced:   { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200' },
  applied:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  screening: { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  interview: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  offer:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  hired:     { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
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
  good:    { label: 'Good Match',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  partial: { label: 'Partial Match', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  poor:    { label: 'Low Match',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MatchBadge({ category, score, variant = 'dark' }: { category: string | null; score: number | null; variant?: 'dark' | 'light' }) {
  if (!category) return <span className="text-xs text-gray-500">—</span>
  const cfg = variant === 'light' ? MATCH_LIGHT : MATCH_CONFIG
  const c = cfg[category as keyof typeof cfg] ?? cfg.poor
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {score != null && <span>{Math.round(score)}%</span>}
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
      className="inline-flex items-center gap-1 font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
      {id}
      {copied ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 opacity-40" />}
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

  useEffect(() => {
    fetch('/api/jd').then(r => r.json()).then(d => setHistory(d.jds ?? []))
  }, [result])

  async function submit() {
    setError(''); setLoading(true); setResult(null)
    try {
      const payload = mode === 'generate'
        ? { action: 'generate', job_title: jobTitle, skills: skills.split(',').map(s => s.trim()).filter(Boolean),
            experience, location, employment_type: employmentType, salary, company_name: companyName }
        : { action: 'analyze', jd_text: analyzeText }
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
      <div className="flex items-center justify-between pb-5 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">JD Intelligence</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered Job Description writer + analyzer</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMode('generate'); setResult(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'generate' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Generate JD
          </button>
          <button onClick={() => { setMode('analyze'); setResult(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'analyze' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Analyze JD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            {mode === 'generate' ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Generate Job Description</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Job Title *</label>
                    <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior React Developer"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Company Name</label>
                    <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Required Skills</label>
                    <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, TypeScript, Node.js, PostgreSQL"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Experience</label>
                    <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="3–5 years"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Hyderabad / Remote"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Employment Type</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                      {['Full-Time','Part-Time','Contract','Internship','Remote','Hybrid'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Salary / CTC (optional)</label>
                    <input value={salary} onChange={e => setSalary(e.target.value)} placeholder="₹12–18 LPA or $80k–100k"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Analyze Existing JD</h2>
                <p className="text-xs text-gray-500 mb-3">Paste a JD to extract skills, suggest interview questions, identify skill clusters, and generate boolean search strings.</p>
                <textarea value={analyzeText} onChange={e => setAnalyzeText(e.target.value)}
                  rows={8} placeholder="Paste the full job description here…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-gray-400 mt-2 mb-1">Or upload a JD file (PDF / DOCX / TXT):</p>
                <LightFileUploadZone
                  label="Upload JD (PDF/DOCX/TXT) — click or drag & drop"
                  accept=".pdf,.docx,.doc,.txt"
                  onText={t => setAnalyzeText(prev => prev ? prev + '\n' + t : t)}
                  disabled={loading}
                />
              </div>
            )}

            {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

            <button onClick={submit} disabled={loading || (mode === 'generate' ? !jobTitle.trim() : !analyzeText.trim())}
              className="mt-4 w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2 bg-blue-600">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <><Sparkles className="w-4 h-4" />{mode === 'generate' ? 'Generate Job Description' : 'Analyze JD'}</>}
            </button>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
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
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-200">{jdText}</pre>
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
function BooleanTab() {
  const [jobTitle, setJobTitle] = useState('')
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [jdText, setJdText] = useState('')
  const [mode, setMode] = useState<'simple' | 'fromjd'>('simple')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [history, setHistory] = useState<{id: string; job_title: string; short_boolean: string; created_at: string}[]>([])

  useEffect(() => {
    fetch('/api/boolean-search').then(r => r.json()).then(d => setHistory(d.searches ?? []))
  }, [result])

  async function submit() {
    setError(''); setLoading(true); setResult(null)
    try {
      const payload = mode === 'fromjd'
        ? { jd_text: jdText }
        : { job_title: jobTitle, skills: skills.split(',').map(s => s.trim()).filter(Boolean), experience }
      const res = await fetch('/api/boolean-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    setLoading(false)
  }

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
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #0284c7)' }}>
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Boolean Search Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate precise boolean strings for LinkedIn, Naukri, Indeed and more</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex gap-2 mb-4">
              <button onClick={() => setMode('simple')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                From Title + Skills
              </button>
              <button onClick={() => setMode('fromjd')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'fromjd' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                From JD Text
              </button>
            </div>

            {mode === 'simple' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Job Title *</label>
                  <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Full Stack Developer"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Skills (comma-separated)</label>
                  <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, MongoDB"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Experience</label>
                  <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="3+ years"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Paste Job Description</label>
                <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={6} placeholder="Paste the full JD here to auto-generate boolean strings…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-gray-400 mt-2 mb-1">Or upload a JD file (PDF / DOCX / TXT):</p>
                <LightFileUploadZone
                  label="Upload JD (PDF/DOCX/TXT) — click or drag & drop"
                  accept=".pdf,.docx,.doc,.txt"
                  onText={t => setJdText(prev => prev ? prev + '\n' + t : t)}
                  disabled={loading}
                />
              </div>
            )}

            {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

            <button onClick={submit} disabled={loading || (mode === 'simple' ? !jobTitle.trim() : !jdText.trim())}
              className="mt-4 w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2 bg-blue-600">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate Boolean Strings</>}
            </button>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
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
            { source: 'Indeed / Monster', cols: ['name', 'email', 'phone', 'skills', 'work_experience', 'current_title', 'current_company', 'location'] },
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
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}
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
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-blue-700 bg-blue-600">
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBatch(null)}>
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

  const categories = [...new Set((catalogue as Record<string, string>[]).map(c => c.category))]
  const connectedCount = integrations.filter(i => i.is_active).length

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
      <p className="text-sm text-gray-400">Loading integrations…</p>
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
    <div className="max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connect your existing tools to sync jobs, contacts and automations</p>
        </div>
        <div className="flex items-center gap-3">
          {connectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">{connectedCount} connected</span>
            </div>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 transition-all">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
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
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm">
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
function CommsTab() {
  const [section, setSection] = useState<'send' | 'templates' | 'logs' | 'providers'>('send')
  const [providers, setProviders] = useState<Record<string, unknown>[]>([])
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([])
  const [logs, setLogs] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  // Send message form
  const [channel, setChannel] = useState('smtp')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  // Provider form
  const [providerChannel, setProviderChannel] = useState('smtp')
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>({})
  const [savingProvider, setSavingProvider] = useState(false)

  // Template form
  const [tmplName, setTmplName] = useState('')
  const [tmplSubject, setTmplSubject] = useState('')
  const [tmplBody, setTmplBody] = useState('')
  const [tmplChannel, setTmplChannel] = useState('email')
  const [tmplPurpose, setTmplPurpose] = useState('custom')
  const [savingTmpl, setSavingTmpl] = useState(false)
  const [tmplResult, setTmplResult] = useState('')
  const [seedingTmpls, setSeedingTmpls] = useState(false)

  async function seedDefaultTemplates() {
    setSeedingTmpls(true)
    try {
      const res = await fetch('/api/comm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_templates' }),
      })
      if (res.ok) { await loadAll() }
    } catch { /* ignore */ }
    setSeedingTmpls(false)
  }

  async function loadAll() {
    setLoading(true)
    const [pl, tl, ll] = await Promise.all([
      fetch('/api/comm?type=providers').then(r => r.json()),
      fetch('/api/comm?type=templates').then(r => r.json()),
      fetch('/api/comm?type=logs').then(r => r.json()),
    ])
    setProviders(pl.providers ?? [])
    setTemplates(tl.templates ?? [])
    setLogs(ll.logs ?? [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  const channelToProvider: Record<string, string> = {
    smtp: 'smtp', outlook: 'outlook', sendgrid: 'sendgrid', mailgun: 'mailgun',
    telegram: 'telegram', whatsapp: 'whatsapp',
  }

  const PROVIDER_FIELDS: Record<string, {name: string; label: string; type?: string; placeholder?: string}[]> = {
    smtp:     [{ name: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' }, { name: 'port', label: 'Port', placeholder: '587' }, { name: 'username', label: 'Username' }, { name: 'password', label: 'App Password', type: 'password' }, { name: 'from_email', label: 'From Email' }, { name: 'from_name', label: 'From Name' }],
    sendgrid: [{ name: 'api_key', label: 'SendGrid API Key', type: 'password' }, { name: 'from_email', label: 'Verified From Email' }, { name: 'from_name', label: 'From Name' }],
    mailgun:  [{ name: 'api_key', label: 'Mailgun API Key', type: 'password' }, { name: 'domain', label: 'Mailgun Domain' }, { name: 'from_email', label: 'From Email' }],
    outlook:  [{ name: 'host', label: 'SMTP Host', placeholder: 'smtp.office365.com' }, { name: 'port', label: 'Port', placeholder: '587' }, { name: 'username', label: 'Username' }, { name: 'password', label: 'Password', type: 'password' }, { name: 'from_email', label: 'From Email' }],
    telegram: [{ name: 'bot_token', label: 'Bot Token', type: 'password' }, { name: 'default_chat_id', label: 'Default Chat ID (optional)' }],
    whatsapp: [{ name: 'account_sid', label: 'Twilio Account SID' }, { name: 'auth_token', label: 'Twilio Auth Token', type: 'password' }, { name: 'whatsapp_number', label: 'WhatsApp Number', placeholder: 'whatsapp:+14155238886' }],
  }

  async function saveProvider() {
    setSavingProvider(true)
    const res = await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_provider', connector_id: providerChannel, config: providerConfig }),
    })
    setSavingProvider(false)
    if (res.ok) { setProviderConfig({}); loadAll() }
  }

  async function saveTemplate() {
    setSavingTmpl(true); setTmplResult('')
    const res = await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_template', name: tmplName, subject: tmplSubject, body: tmplBody, channel: tmplChannel, purpose: tmplPurpose }),
    })
    const data = await res.json()
    setSavingTmpl(false)
    setTmplResult(res.ok ? 'Template saved!' : `Error: ${data.error}`)
    if (res.ok) { setTmplName(''); setTmplSubject(''); setTmplBody(''); loadAll() }
  }

  async function sendMsg() {
    setSending(true); setSendResult('')
    const body: Record<string, unknown> = { action: 'send', connector_id: channelToProvider[channel] ?? channel, to, subject, message }
    if (selectedTemplate) body.template_id = selectedTemplate
    const res = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSending(false)
    setSendResult(res.ok ? '✓ Message sent!' : `Error: ${data.error}`)
    if (res.ok) loadAll()
  }

  const CHANNELS = [
    { id: 'smtp', label: 'Email (SMTP)' }, { id: 'sendgrid', label: 'SendGrid' },
    { id: 'mailgun', label: 'Mailgun' }, { id: 'outlook', label: 'Outlook/O365' },
    { id: 'telegram', label: 'Telegram' }, { id: 'whatsapp', label: 'WhatsApp' },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
          <Send className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Communication Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send emails, WhatsApp, and Telegram messages to candidates</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'send', label: 'Send Message' },
          { key: 'templates', label: 'Templates' },
          { key: 'providers', label: 'Providers' },
          { key: 'logs', label: 'Delivery Logs' },
        ].map(s => (
          <button key={s.key} onClick={() => setSection(s.key as typeof section)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${section === s.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* SEND */}
          {section === 'send' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                  {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Use Template (optional)</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— No template —</option>
                  {templates.map(t => <option key={t.id as string} value={t.id as string}>{t.name as string}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{channel === 'telegram' ? 'Chat ID' : 'To (email or phone)'}</label>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder={channel === 'telegram' ? '@username or chat ID' : 'candidate@email.com'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {['smtp','sendgrid','mailgun','outlook'].includes(channel) && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Interview Schedule — Software Engineer"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                  placeholder="Dear candidate, we are pleased to invite you for…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-blue-500" />
              </div>
              {sendResult && <div className={`p-2 rounded-lg text-xs ${sendResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{sendResult}</div>}
              <button onClick={sendMsg} disabled={sending || !to}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2 bg-blue-600">
                {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Send Message</>}
              </button>
            </div>
          )}

          {/* TEMPLATES */}
          {section === 'templates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Create Template</h3>
                <input value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="Template name (e.g. Interview Invite)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={tmplChannel} onChange={e => setTmplChannel(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                    {['email','whatsapp','telegram','sms','all'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={tmplPurpose} onChange={e => setTmplPurpose(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                    {['interview_invite','shortlist','rejection','follow_up','offer','reminder','welcome','custom'].map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <input value={tmplSubject} onChange={e => setTmplSubject(e.target.value)} placeholder="Subject (for email templates)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                <textarea value={tmplBody} onChange={e => setTmplBody(e.target.value)} rows={6}
                  placeholder="Dear {{name}}, you have been shortlisted for {{position}}…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-blue-500" />
                <p className="text-[10px] text-gray-400">Use {'{{variable}}'} for dynamic values</p>
                {tmplResult && <div className={`p-2 rounded-lg text-xs ${tmplResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{tmplResult}</div>}
                <button onClick={saveTemplate} disabled={savingTmpl || !tmplName || !tmplBody}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 bg-blue-600">
                  {savingTmpl ? 'Saving…' : 'Save Template'}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Saved Templates ({templates.length})</h3>
                  {templates.length === 0 && (
                    <button onClick={seedDefaultTemplates} disabled={seedingTmpls}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50">
                      {seedingTmpls ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {seedingTmpls ? 'Loading…' : 'Load Default Templates'}
                    </button>
                  )}
                </div>
                {templates.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-xs text-gray-400">No templates yet</p>
                    <p className="text-xs text-gray-400">Click &quot;Load Default Templates&quot; to add ready-made recruitment templates</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <div key={t.id as string} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{t.name as string}</p>
                          <div className="flex gap-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 capitalize">{t.channel as string}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">{(t.purpose as string)?.replace('_',' ')}</span>
                          </div>
                        </div>
                        {!!t.subject && <p className="text-xs text-gray-500 mt-0.5">Subject: {t.subject as string}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROVIDERS */}
          {section === 'providers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Configure Provider</h3>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Provider</label>
                  <select value={providerChannel} onChange={e => { setProviderChannel(e.target.value); setProviderConfig({}) }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500">
                    {Object.keys(PROVIDER_FIELDS).map(c => <option key={c} value={c}>{CHANNELS.find(ch => ch.id === c)?.label ?? c}</option>)}
                  </select>
                </div>
                {(PROVIDER_FIELDS[providerChannel] ?? []).map(field => (
                  <div key={field.name}>
                    <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                    <input type={field.type ?? 'text'} value={providerConfig[field.name] ?? ''} placeholder={field.placeholder ?? ''}
                      onChange={e => setProviderConfig(v => ({ ...v, [field.name]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
                <button onClick={saveProvider} disabled={savingProvider}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 bg-blue-600">
                  {savingProvider ? 'Saving…' : 'Save Provider'}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Providers</h3>
                {providers.length === 0 ? <p className="text-xs text-gray-400 text-center py-6">No providers configured</p> : (
                  <div className="space-y-2">
                    {providers.map(p => (
                      <div key={p.id as string} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-800 capitalize">{p.connector_id as string}</p>
                          <p className="text-xs text-gray-500">Channel: {p.channel as string}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DELIVERY LOGS */}
          {section === 'logs' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Delivery Logs</h2>
                <button onClick={loadAll} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <RefreshCw className="w-3 h-3" />Refresh
                </button>
              </div>
              {logs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No messages sent yet</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <div key={log.id as string} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <div>
                        <p className="text-sm text-gray-800">{log.to_address as string}</p>
                        {!!log.subject && <p className="text-xs text-gray-500 mt-0.5">{log.subject as string}</p>}
                        <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{log.channel as string} · {new Date(log.created_at as string).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          log.status === 'sent' ? 'bg-green-50 text-green-700 border-green-200' :
                          log.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>{log.status as string}</span>
                        {!!log.error_message && <p className="text-[10px] text-red-500 max-w-[140px] truncate">{log.error_message as string}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'pipeline' | 'candidates' | 'screen' | 'compose' | 'jobs' | 'analytics' | 'settings' | 'jd' | 'boolean' | 'import' | 'integrations' | 'comms'>('pipeline')
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterMatch, setFilterMatch] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [filterDate, setFilterDate] = useState('')  // 'today' | '7days' | '30days' | ''
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({})
  const [topSkills, setTopSkills] = useState<Array<{ skill: string; count: number }>>([])

  // New Job modal state
  const [showNewJob, setShowNewJob] = useState(false)
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
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
      if (filterDate) params.set('date_range', filterDate)

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
  }, [searchQ, filterStage, filterMatch, filterJob, filterSkill, selectedJob, filterDate])

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
        setInviteResult({ ok: true, message: `Invite sent to ${inviteEmail.trim()}` })
        setInviteEmail('')
        loadTeamMembers()
      } else {
        setInviteResult({ ok: false, message: data.error ?? 'Failed to send invite' })
      }
    } catch { setInviteResult({ ok: false, message: 'Network error' }) } finally {
      setInviting(false)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return
    try {
      const res = await fetch(`/api/tenant/members?member_id=${memberId}`, { method: 'DELETE' })
      if (res.ok) loadTeamMembers()
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
    if (activeTab === 'settings') { loadApiKeys(); loadIntegrations(); loadAuditLogs(); loadTeamMembers() }
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
    setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
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
    setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', salary_min: '', salary_max: '', experience_min: '', experience_max: '', department: '' })
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
        <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: '#191b24', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f655c1, #995af2, #427cf0, #00d4ff)' }}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none tracking-tight">SRP AI Labs</p>
                <p className="text-[11px] leading-none mt-0.5 font-medium" style={{ background: 'linear-gradient(90deg, #f655c1, #995af2, #427cf0, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SmartRecruit</p>
              </div>
            </div>
          </div>

          {/* Sidebar plan badge */}
          {profileData?.subscription && profileData.subscription.plan !== 'free' && (
            <div className="mx-3 mt-3 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(153,90,242,0.15)', border: '1px solid rgba(153,90,242,0.3)' }}>
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold capitalize" style={{ color: '#c4a8ff' }}>{profileData.subscription.plan} Plan</span>
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

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto min-h-0">
            {([
              { tab: 'pipeline',   icon: Layers,      label: 'Pipeline',   badge: null },
              { tab: 'candidates', icon: Users,        label: 'Candidates', badge: null },
              { tab: 'screen',     icon: Brain,        label: 'AI Screen',  badge: 'AI' },
              { tab: 'compose',    icon: Mail,         label: 'Compose',    badge: 'AI' },
              { tab: 'jobs',       icon: Briefcase,    label: 'Jobs',       badge: null },
              { tab: 'analytics',  icon: BarChart3,    label: 'Analytics',  badge: null },
              { tab: 'jd',         icon: FileText,     label: 'JD Writer',  badge: 'AI' },
              { tab: 'boolean',    icon: Search,       label: 'Boolean',    badge: 'AI' },
              { tab: 'import',     icon: Upload,       label: 'Import',     badge: null },
              { tab: 'integrations', icon: Link2,      label: 'Integrations', badge: null },
              { tab: 'comms',      icon: Send,         label: 'Comms Hub',  badge: null },
              { tab: 'settings',   icon: Settings,     label: 'Settings',   badge: null },
            ] as const).map(({ tab, icon: Icon, label, badge }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={activeTab === tab
                  ? { background: '#1849D6', color: '#FFFFFF' }
                  : { color: '#8892A4' }}
                onMouseEnter={e => { if (activeTab !== tab) { (e.currentTarget as HTMLButtonElement).style.background = '#1e2235'; (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF' } }}
                onMouseLeave={e => { if (activeTab !== tab) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#8892A4' } }}>
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{label}</span>
                {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}>{badge}</span>}
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
                ? <img src={user.image} alt="" className="w-8 h-8 rounded-full" style={{ border: '2px solid rgba(59,130,246,0.5)' }} />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-blue-600">{user?.name?.[0] ?? '?'}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[11px] truncate text-blue-200">{user?.email}</p>
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
          <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-0 flex-wrap">
            {([
              { icon: Briefcase,   borderColor: 'border-l-blue-500',   iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    label: 'Active Jobs',    value: jobs.length },
              { icon: Users,       borderColor: 'border-l-indigo-500',  iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600',  label: 'Candidates',     value: totalCandidates },
              { icon: Clock,       borderColor: 'border-l-amber-500',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',   label: 'Interviews',     value: interviewCount },
              { icon: CheckCircle, borderColor: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', label: 'Total Hired',    value: hiredCount },
              { icon: TrendingUp,  borderColor: 'border-l-sky-500',     iconBg: 'bg-sky-50',     iconColor: 'text-sky-600',     label: 'Hire Rate',      value: totalCandidates > 0 ? `${Math.round((hiredCount / totalCandidates) * 100)}%` : '—' },
            ] as const).map(({ icon: Icon, borderColor, iconBg, iconColor, label, value }) => (
              <div key={label} className={`flex items-center gap-3 px-5 py-3 border-l-4 ${borderColor} border-r border-gray-100`}>
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium leading-none mb-0.5">{label}</p>
                  <p className="text-lg font-extrabold text-gray-900 leading-tight">{value}</p>
                </div>
              </div>
            ))}
            <div className="ml-auto pr-4 flex items-center gap-2">
              <button onClick={() => setShowNewCandidate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-sm text-gray-700 font-medium transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Candidate
              </button>
              <button onClick={() => setShowNewJob(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm bg-blue-600">
                <Plus className="w-3.5 h-3.5" /> New Job
              </button>
            </div>
          </div>

          <div className="px-6 py-6">

            {/* ── PIPELINE ─────────────────────────────────────────────────── */}
            {activeTab === 'pipeline' && (
              <div>
                {/* Pipeline Header */}
                <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #427cf0, #6366f1)' }}>
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Pipeline</h1>
                      <p className="text-sm text-gray-500 mt-0.5">Drag &amp; drop candidates across stages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                        <option value="">All Jobs</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0,8)})</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <button onClick={loadData} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors">
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Pipeline stats bar */}
                <div className="grid grid-cols-6 gap-3 mb-5">
                  {PIPELINE_STAGES.map(stage => {
                    const count = candidates.filter(c => c.pipeline_stage === stage.key).length
                    const stageColors: Record<string, { bg: string; accent: string; text: string }> = {
                      sourced:   { bg: '#F1F5F9', accent: '#64748B', text: '#374151' },
                      applied:   { bg: '#EFF6FF', accent: '#3B82F6', text: '#1D4ED8' },
                      screening: { bg: '#F5F3FF', accent: '#8B5CF6', text: '#7C3AED' },
                      interview: { bg: '#FFFBEB', accent: '#F59E0B', text: '#D97706' },
                      offer:     { bg: '#ECFDF5', accent: '#10B981', text: '#059669' },
                      hired:     { bg: '#F0FDF4', accent: '#22C55E', text: '#16A34A' },
                    }
                    const sc = stageColors[stage.key] ?? stageColors.sourced
                    return (
                      <div key={stage.key} className="rounded-xl p-3 border text-center"
                        style={{ background: sc.bg, borderColor: sc.accent + '30' }}>
                        <p className="text-xl font-bold" style={{ color: sc.accent }}>{count}</p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: sc.text }}>{stage.label}</p>
                      </div>
                    )
                  })}
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
                      const colAccents: Record<string, { header: string; border: string; badge: string; badgeText: string }> = {
                        sourced:   { header: '#64748B', border: '#CBD5E1', badge: '#E2E8F0', badgeText: '#475569' },
                        applied:   { header: '#3B82F6', border: '#BFDBFE', badge: '#DBEAFE', badgeText: '#1D4ED8' },
                        screening: { header: '#8B5CF6', border: '#DDD6FE', badge: '#EDE9FE', badgeText: '#7C3AED' },
                        interview: { header: '#F59E0B', border: '#FDE68A', badge: '#FEF3C7', badgeText: '#D97706' },
                        offer:     { header: '#10B981', border: '#A7F3D0', badge: '#D1FAE5', badgeText: '#059669' },
                        hired:     { header: '#22C55E', border: '#BBF7D0', badge: '#DCFCE7', badgeText: '#16A34A' },
                      }
                      const ca = colAccents[stage.key] ?? colAccents.sourced
                      return (
                        <div key={stage.key} className="flex flex-col rounded-xl overflow-hidden shadow-sm"
                          style={{ border: `1px solid ${ca.border}` }}
                          onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                          onDragLeave={() => setDragOverStage(null)}
                          onDrop={e => {
                            e.preventDefault()
                            if (draggingId) moveStage(draggingId, stage.key)
                            setDraggingId(null); setDragOverStage(null)
                          }}>
                          {/* Column header */}
                          <div className="flex items-center justify-between px-3 py-2.5"
                            style={{ background: ca.header }}>
                            <div className="flex items-center gap-2">
                              <stage.icon className="w-3.5 h-3.5 text-white opacity-90" />
                              <span className="text-xs font-bold text-white tracking-wide">{stage.label}</span>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                              {stageCands.length}
                            </span>
                          </div>
                          {/* Column body */}
                          <div className={`flex-1 p-2 space-y-2 min-h-[300px] transition-all ${
                            isOver ? 'bg-blue-50' : 'bg-white'
                          }`} style={isOver ? { borderTop: `2px solid ${ca.header}` } : {}}>
                            {stageCands.length === 0
                              ? <div className="flex flex-col items-center justify-center h-32 gap-2">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{ background: ca.badge }}>
                                    <stage.icon className="w-4 h-4" style={{ color: ca.header }} />
                                  </div>
                                  <p className={`text-center text-xs font-medium ${isOver ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {isOver ? 'Drop here' : 'Empty'}
                                  </p>
                                </div>
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
                <div className="flex items-center justify-between mb-4 pb-5 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-blue-600">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Candidates</h1>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {filterSkill ? <><span className="text-blue-600 font-semibold">{candidates.length}</span> with &quot;{filterSkill}&quot;</> : `${candidates.length} total`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input value={searchQ} onChange={e => {
                        const v = e.target.value
                        setSearchQ(v)
                        // Smart ID routing: CAN-xxxxx → candidates tab, JOB-xxxxx → jobs tab
                        if (/^CAN-\d+/i.test(v.trim())) { setActiveTab('candidates') }
                        else if (/^JOB-\d+/i.test(v.trim())) { setActiveTab('jobs') }
                      }}
                      placeholder="Name, email, CAN-000245…"
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
                  <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                  </select>
                  {(searchQ || filterStage || filterMatch || filterJob || filterSkill || filterDate) && (
                    <button onClick={() => { setSearchQ(''); setFilterStage(''); setFilterMatch(''); setFilterJob(''); setFilterSkill(''); setFilterDate('') }}
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
                          {['ID', 'Candidate', 'Uploaded', 'Updated', 'Match', 'Stage', 'Job', 'Skills', 'Move Stage'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No candidates found</td></tr>
                        ) : candidates.map((c, i) => (
                          <tr key={c.id} onClick={() => setSelectedCandidate(c)} className={`border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                            <td className="px-4 py-3"><ShortIdBadge id={c.short_id ?? c.id.slice(0, 8)} /></td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{c.candidate_name}</p>
                              <p className="text-xs text-gray-500">{c.candidate_email}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{c.updated_at && c.updated_at !== c.created_at ? fmtDate(c.updated_at) : '—'}</td>
                            <td className="px-4 py-3"><MatchBadge category={c.match_category} score={c.ai_score} variant="light" /></td>
                            <td className="px-4 py-3"><StagePill stage={c.pipeline_stage} variant="light" /></td>
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
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-blue-600">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">AI Screening</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Score & rank candidates against your job description</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {(['single', 'bulk'] as const).map(m => (
                      <button key={m} onClick={() => setScreenMode(m)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${screenMode === m ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {m === 'single' ? 'Single CV' : 'Bulk CVs'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {/* JD panel */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Job Description</label>
                    <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={10}
                      placeholder="Paste the full job description here…"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none" />
                    <p className="text-xs text-gray-500">Or upload JD file:</p>
                    <FileUploadZone label="Upload JD (PDF/DOCX/TXT)" accept=".pdf,.docx,.doc,.txt" multiple={false}
                      onTexts={([t]) => setJdText(t.text)} disabled={screening} />
                  </div>

                  {/* Resume panel */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {screenMode === 'single' ? 'Candidate Resume' : `Bulk Resumes (${bulkTexts.length} loaded)`}
                    </label>
                    {screenMode === 'single' ? (
                      <>
                        <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={10}
                          placeholder="Paste the candidate's resume text here…"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none" />
                        <p className="text-xs text-gray-500">Or upload resume file:</p>
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
                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-blue-400">
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
                  className="mb-6 flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-all disabled:opacity-50">
                  {screening ? <><Loader2 className="w-4 h-4 animate-spin" /> Screening…</> : <><Sparkles className="w-4 h-4" /> Run AI Screening</>}
                </button>

                {screenResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-700">{screenResults.length} result{screenResults.length > 1 ? 's' : ''} — saved to Candidates</h2>
                      <button onClick={() => setActiveTab('candidates')}
                        className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2">
                        View in Candidates →
                      </button>
                    </div>
                    {screenResults.map((r, i) => (
                      <ScreenResultCard key={i} result={r} onAddCandidate={(cid) => { loadData() }} defaultOpen={screenResults.length === 1} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── COMPOSE ──────────────────────────────────────────────────── */}
            {activeTab === 'compose' && (
              <div>
                {/* Header */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #427cf0, #06b6d4)' }}>
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">AI Compose</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Generate, rewrite or reply to recruitment messages</p>
                  </div>
                </div>

                {/* ── Two mode cards ─────────────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">

                  {/* ── Panel A: Generate New Email ── */}
                  <div className={`rounded-2xl border p-5 transition-all ${
                    composeMode === 'generate'
                      ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100 shadow-sm'
                      : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80'
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
                      : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80'
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
                <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Job Posts</h1>
                      <p className="text-sm text-gray-500 mt-0.5">{jobs.length} active jobs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowNewJob(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:bg-blue-700 shadow-sm bg-blue-600">
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
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:bg-blue-700 bg-blue-600">
                      Create Job Post
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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
                        {jobs.map(job => {
                          const jobCands = candidates.filter(c => c.job_posts?.id === job.id)
                          return (
                            <tr key={job.id} onClick={() => openJobDetails(job)}>
                              <td><ShortIdBadge id={job.short_id ?? job.id.slice(0, 8)} /></td>
                              <td>
                                <p className="font-semibold text-gray-900 text-sm">{job.title}</p>
                                {job.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{job.description}</p>}
                              </td>
                              <td className="text-sm text-gray-600">{job.company || '—'}</td>
                              <td className="text-sm text-gray-500">{job.location || '—'}</td>
                              <td className="text-sm text-gray-500 capitalize">{job.type || '—'}</td>
                              <td className="text-center">
                                <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                                  <Users className="w-3.5 h-3.5 text-gray-400" />
                                  {jobCands.length}
                                </span>
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
                                  <button onClick={() => openJobDetails(job)}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                    <Sparkles className="w-3 h-3" /> {job.post_contents ? 'Posts' : 'JD'}
                                  </button>
                                  <button onClick={() => { setSelectedJob(job.id); setActiveTab('pipeline') }}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                    Pipeline <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS ────────────────────────────────────────────────── */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">

                {/* Page header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Recruitment Analytics</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Live snapshot of your hiring pipeline and team performance</p>
                  </div>
                  <button onClick={loadData} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 transition-all">
                    <RefreshCw className="w-3 h-3" /> Refresh
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
                          sourced: 'bg-slate-400', applied: 'bg-blue-500', screening: 'bg-violet-500',
                          interview: 'bg-amber-500', offer: 'bg-teal-500', hired: 'bg-emerald-500',
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
                          { key: 'good',    label: 'Good Match',    bar: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
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
                            const barColors = ['bg-blue-500', 'bg-indigo-500', 'bg-sky-500', 'bg-teal-500', 'bg-cyan-500']
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
            {activeTab === 'settings' && (
              <div className="max-w-3xl">
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #64748b, #334155)' }}>
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Account Settings</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage your profile, subscription and API access</p>
                  </div>
                </div>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : profileData ? (
                  <div className="space-y-5">

                    {/* Profile Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
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
                          ? <img src={profileData.user.image} alt="" className="w-16 h-16 rounded-full ring-2 ring-blue-200" />
                          : <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ring-2 ring-blue-200 bg-blue-600">
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
                                    className="px-2 py-1 rounded text-white text-xs hover:bg-blue-700 disabled:opacity-50 bg-blue-600">
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
                          { label: 'AI Screens',   value: profileData.usage.screens_this_month,  limit: profileData.subscription.plan === 'free' ? 20 : null, icon: Brain,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
                          { label: 'AI Compose',   value: profileData.usage.composes_this_month, limit: null,                                                  icon: Mail,       color: 'text-blue-600',   bg: 'bg-blue-50' },
                          { label: 'Candidates',   value: profileData.usage.total_candidates,    limit: null,                                                  icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50' },
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
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Email &amp; Calendar</h2>
                      </div>
                      <p className="text-xs text-gray-400 mb-5">Connect your work email and calendar to send interview invites and schedule meetings.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Gmail */}
                        <a href="/api/oauth/gmail" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600">G</div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">Gmail</p>
                              <p className="text-xs text-gray-400">Send via Google</p>
                            </div>
                          </div>
                          <span className="text-xs text-blue-600 group-hover:underline">Connect →</span>
                        </a>
                        {/* Outlook Email */}
                        <a href="/api/oauth/outlook" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">O</div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">Outlook</p>
                              <p className="text-xs text-gray-400">Send via Microsoft</p>
                            </div>
                          </div>
                          <span className="text-xs text-blue-600 group-hover:underline">Connect →</span>
                        </a>
                        {/* Google Calendar */}
                        <a href="/api/oauth/gcal" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-xs font-bold text-green-600">Cal</div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">Google Calendar</p>
                              <p className="text-xs text-gray-400">Schedule + Meet links</p>
                            </div>
                          </div>
                          <span className="text-xs text-green-600 group-hover:underline">Connect →</span>
                        </a>
                        {/* Outlook Calendar */}
                        <a href="/api/oauth/outlookcal" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">OC</div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">Outlook Calendar</p>
                              <p className="text-xs text-gray-400">Schedule + Teams links</p>
                            </div>
                          </div>
                          <span className="text-xs text-blue-600 group-hover:underline">Connect →</span>
                        </a>
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
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 hover:bg-blue-700 bg-blue-600">
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

                    {/* Team Management */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
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
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!m.invite_accepted && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                m.role === 'owner' ? 'bg-indigo-100 text-indigo-700' :
                                m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                m.role === 'recruiter' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{m.role}</span>
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
                          <p className={`mt-2 text-xs ${inviteResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                            {inviteResult.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Audit Trail */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
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
                        <div className="overflow-x-auto rounded-lg border border-gray-100">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Action</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Resource</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">ID</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Result</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">When</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map(log => (
                                <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-gray-700">{log.action}</td>
                                  <td className="px-3 py-2 text-gray-500 capitalize">{log.resource_type}</td>
                                  <td className="px-3 py-2 font-mono text-gray-400">{log.resource_id ? log.resource_id.slice(0, 12) + '…' : '—'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.result === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                      {log.result}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtDate(log.created_at, true)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
            {activeTab === 'jd' && <JDTab />}

            {/* ── BOOLEAN SEARCH ──────────────────────────────────────────── */}
            {activeTab === 'boolean' && <BooleanTab />}

            {/* ── IMPORT ENGINE ───────────────────────────────────────────── */}
            {activeTab === 'import' && <ImportTab />}

            {/* ── INTEGRATION HUB ─────────────────────────────────────────── */}
            {activeTab === 'integrations' && <IntegrationsTab />}

            {/* ── COMMUNICATION HUB ───────────────────────────────────────── */}
            {activeTab === 'comms' && <CommsTab />}

          </div>
        </main>
      </div>

      {/* ── New Job Modal ──────────────────────────────────────────────────────── */}
      {showNewJob && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 overflow-y-auto flex items-start justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto flex flex-col border border-gray-100" style={{ maxHeight: '92vh' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Briefcase className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">New Job Post</h2>
                  <p className="text-xs text-gray-400">Fill in the details below to create a new listing</p>
                </div>
              </div>
              <button onClick={() => setShowNewJob(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-4 overflow-y-auto flex-1 px-6 py-5">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Job Title <span className="text-red-500">*</span></label>
                <input value={newJob.title} onChange={e => setNewJob(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
              </div>

              {/* Company + Department row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Company</label>
                  <input value={newJob.company} onChange={e => setNewJob(p => ({ ...p, company: e.target.value }))}
                    placeholder="e.g. SRP AI Labs"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Department</label>
                  <input value={newJob.department} onChange={e => setNewJob(p => ({ ...p, department: e.target.value }))}
                    placeholder="e.g. Engineering"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                </div>
              </div>

              {/* Location + Type row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Location</label>
                  <input value={newJob.location} onChange={e => setNewJob(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Hyderabad / Remote"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Employment Type</label>
                  <select value={newJob.type} onChange={e => setNewJob(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all bg-white">
                    {['full-time', 'part-time', 'contract', 'remote', 'internship'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Range */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Salary / CTC Range (₹ LPA)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={newJob.salary_min} onChange={e => setNewJob(p => ({ ...p, salary_min: e.target.value }))}
                    placeholder="Min (e.g. 8)"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                  <span className="text-gray-400 text-sm font-medium flex-shrink-0">to</span>
                  <input type="number" min="0" value={newJob.salary_max} onChange={e => setNewJob(p => ({ ...p, salary_max: e.target.value }))}
                    placeholder="Max (e.g. 20)"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                </div>
              </div>

              {/* Experience Range */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Experience Required (years)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={newJob.experience_min} onChange={e => setNewJob(p => ({ ...p, experience_min: e.target.value }))}
                    placeholder="Min (e.g. 2)"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                  <span className="text-gray-400 text-sm font-medium flex-shrink-0">to</span>
                  <input type="number" min="0" value={newJob.experience_max} onChange={e => setNewJob(p => ({ ...p, experience_max: e.target.value }))}
                    placeholder="Max (e.g. 8)"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all" />
                </div>
              </div>

              {/* JD File Upload */}
              <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-1">
                <label className="text-xs font-semibold text-indigo-600 mb-1 block px-2 pt-1">Upload JD File (auto-fills fields below)</label>
                <FileUploadZone label="Drop JD — PDF / DOCX / TXT" accept=".pdf,.docx,.doc,.txt" multiple={false}
                  onTexts={([t]) => {
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
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description</label>
                <textarea value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Role overview — or upload a JD file above to auto-fill…"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Requirements</label>
                <textarea value={newJob.requirements} onChange={e => setNewJob(p => ({ ...p, requirements: e.target.value }))}
                  rows={3} placeholder="Key skills and experience required…"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all resize-none" />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/60 rounded-b-2xl">
              <button onClick={() => setShowNewJob(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                Cancel
              </button>
              <button onClick={createJob} disabled={savingJob || !newJob.title}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {savingJob ? 'Creating…' : 'Create Job'}
              </button>
              <button onClick={createAndGenerate} disabled={savingJob || !newJob.title}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                <Sparkles className="w-3.5 h-3.5" /> Create &amp; Generate Posts
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
                <h2 className="text-lg font-bold text-white">Job Details &amp; Social Posts</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {genPostJob.title}
                  {genPostJob.company ? ` · ${genPostJob.company}` : ''}
                  {genPostJob.short_id ? <> · <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-blue-300">{genPostJob.short_id}</span></> : ''}
                </p>
                <p className="text-[10px] text-gray-600 mt-1 font-mono">
                  Posted: {fmtDate(genPostJob.created_at)}
                  {genPostJob.updated_at && genPostJob.updated_at !== genPostJob.created_at ? ` · Updated: ${fmtDate(genPostJob.updated_at)}` : ''}
                </p>
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
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            </div>

            <button
              onClick={() => generateJobPosts(genPostJob)}
              disabled={generatingPosts}
              className="mb-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-all disabled:opacity-50 flex-shrink-0">
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
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${genPostTab === p ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
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
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-5 text-center">
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
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2">
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
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      const d = await res.json()
      if (res.ok && d.text) {
        setFileName(file.name)
        onText(d.text)
      } else {
        setParseError(d.error ?? `Failed to parse ${file.name}`)
      }
    } catch { setParseError('Network error') }
    finally { setParsing(false) }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
        dragging ? 'border-blue-400 bg-blue-50' :
        parseError ? 'border-red-300 bg-red-50' :
        fileName ? 'border-green-400 bg-green-50' :
        'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragEnter={e => { e.preventDefault(); setDragging(true) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { e.preventDefault(); setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f) }}
      onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); if (ref.current) ref.current.value = '' }} />
      {parsing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Parsing file…
        </div>
      ) : parseError ? (
        <div>
          <AlertCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <p className="text-xs text-red-600">{parseError}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click to try again</p>
        </div>
      ) : fileName ? (
        <div>
          <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <p className="text-xs text-green-700 font-medium">{fileName} — loaded</p>
          <p className="text-xs text-gray-400 mt-0.5">Click to replace</p>
        </div>
      ) : (
        <div>
          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click or drag & drop</p>
        </div>
      )}
    </div>
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
function ScreenResultCard({ result: r, onAddCandidate, defaultOpen = true }: { result: ScreenResult; onAddCandidate: (id?: string) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [screenedAt] = useState(() => fmtDate(r.screened_at ?? new Date().toISOString(), true))

  const ev = r.evaluation

  // Skills — prefer new jd_match fields, fall back to legacy evaluation
  const matchedSkills  = r.jd_match?.matching_skills ?? [...(ev?.high_match_skills ?? []), ...(ev?.medium_match_skills ?? [])]
  const missingSkills  = r.jd_match?.missing_skills  ?? ev?.low_or_missing_match_skills ?? ev?.missing_skills ?? []
  const strengths      = ev?.candidate_strengths ?? ev?.strengths ?? []
  const weaknesses     = ev?.candidate_weaknesses ?? ev?.weaknesses ?? []
  // Red flags — prefer explicit red_flags array, fall back to weaknesses
  const redFlags = (r.red_flags && r.red_flags.length > 0) ? r.red_flags : weaknesses.slice(0, 3)

  const score = Math.round(r.score ?? 0)

  // Classification badge config (new AI schema)
  const classConfig: Record<string, { bg: string; text: string; border: string }> = {
    STRONG: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    KAV:    { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
    REJECT: { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300' },
  }
  const cc = r.classification ? (classConfig[r.classification] ?? classConfig.REJECT) : null

  const scoreGrade =
    score >= 71 ? { label: 'Strong',   color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' } :
    score >= 60 ? { label: 'KAV',      color: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-300' } :
    score >= 45 ? { label: 'Average',  color: '#3b82f6', bg: 'bg-blue-50',    border: 'border-blue-200',    ring: 'ring-blue-300' } :
                  { label: 'Reject',   color: '#ef4444', bg: 'bg-red-50',     border: 'border-red-200',     ring: 'ring-red-300' }

  const decisionConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    'Shortlisted': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
    'On Hold':     { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500' },
    'Rejected':    { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500' },
  }
  const dc = decisionConfig[r.decision] ?? decisionConfig['Rejected']

  const jdMatch   = r.jd_match?.match_percent ?? ev?.overall_fit_rating
  const riskLevel = ev?.risk_level

  // Experience audit — show if difference is notable
  const expAudit = r.experience_audit
  const expDiff  = expAudit?.difference_years != null ? Math.abs(expAudit.difference_years) : 0
  const showExpAudit = expAudit && (expDiff > 0.5 || expAudit.verdict === 'Mismatch')

  // Gap analysis
  const gaps = r.gap_analysis?.gaps ?? []
  const totalMissingMonths = r.gap_analysis?.total_missing_months ?? 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

      {/* ── Card Header ─── */}
      <div className="flex items-start gap-4 p-5">

        {/* Score Badge */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl border-2 ${scoreGrade.bg} ${scoreGrade.border} shadow-sm`}>
          <span className="text-2xl font-black leading-none" style={{ color: scoreGrade.color }}>{score}</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">/ 100</span>
          <span className="text-[9px] font-semibold mt-0.5" style={{ color: scoreGrade.color }}>{scoreGrade.label}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-bold text-gray-900">{r.name || 'Unknown Candidate'}</h3>
            {r.short_id && <ShortIdBadge id={r.short_id} />}
          </div>
          <p className="text-xs text-gray-500 mb-2.5">
            {r.email}
            {r.contact_number ? <span className="text-gray-300"> · </span> : null}
            {r.contact_number}
            {r.current_company ? <><span className="text-gray-300"> · </span><span className="font-medium text-gray-600">{r.current_company}</span></> : null}
          </p>

          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${dc.bg} ${dc.text} ${dc.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
              {r.decision}
            </span>
            {/* Classification badge (new AI schema) */}
            {cc && r.classification && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${cc.bg} ${cc.text} ${cc.border}`}>
                {r.classification === 'KAV' ? 'Keep An Eye' : r.classification}
              </span>
            )}
            {/* Recommendation badge */}
            {r.recommendation && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                r.recommendation === 'Hire'  ? 'bg-green-50  text-green-700  border-green-200' :
                r.recommendation === 'Hold'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                               'bg-gray-100  text-gray-600   border-gray-200'
              }`}>Rec: {r.recommendation}</span>
            )}
            {jdMatch != null && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                JD Match: {jdMatch}%
              </span>
            )}
            {riskLevel && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                riskLevel.toLowerCase() === 'high'   ? 'bg-red-50    text-red-700    border-red-200' :
                riskLevel.toLowerCase() === 'medium' ? 'bg-amber-50  text-amber-700  border-amber-200' :
                                                       'bg-green-50  text-green-700  border-green-200'
              }`}>⚠ Risk: {riskLevel}</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-mono mt-2">Screened: {screenedAt}</p>
        </div>

        <button onClick={() => setOpen(v => !v)}
          className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all mt-0.5 ${open ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}>
          {open ? 'Collapse' : 'View Details'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <>
          {/* ── Executive Summary (new AI schema) ─── */}
          {r.executive_summary && (
            <div className="px-5 pb-4 border-t border-gray-100 bg-indigo-50/30">
              <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide mt-3 mb-1.5 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Executive Summary
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{r.executive_summary}</p>
            </div>
          )}

          {/* ── 3-Column Skills Grid ─── */}
          {(matchedSkills.length > 0 || missingSkills.length > 0 || redFlags.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-gray-100">

              {/* Matched Skills */}
              <div className="p-4 border-r border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Matched Skills</p>
                  {matchedSkills.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{matchedSkills.length}</span>
                  )}
                </div>
                {matchedSkills.length === 0
                  ? <p className="text-xs text-gray-400 italic">None detected</p>
                  : <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">{s}</span>
                      ))}
                    </div>
                }
              </div>

              {/* Missing Skills */}
              <div className="p-4 border-r border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Missing Skills</p>
                  {missingSkills.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{missingSkills.length}</span>
                  )}
                </div>
                {missingSkills.length === 0
                  ? <p className="text-xs text-gray-400 italic">None detected</p>
                  : <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">{s}</span>
                      ))}
                    </div>
                }
              </div>

              {/* Red Flags */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Red Flags</p>
                  {redFlags.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{redFlags.length}</span>
                  )}
                </div>
                {redFlags.length === 0
                  ? <p className="text-xs text-gray-400 italic">None detected</p>
                  : <ul className="space-y-1.5">
                      {redFlags.map((f, i) => (
                        <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                          <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                }
              </div>
            </div>
          )}

          {/* ── Experience Audit + Gap Analysis (new AI schema) ─── */}
          {(showExpAudit || totalMissingMonths > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-gray-100 bg-orange-50/20">
              {showExpAudit && expAudit && (
                <div className="p-4 border-r border-gray-100">
                  <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Experience Audit
                  </p>
                  <div className="space-y-1 text-xs text-gray-700">
                    <div className="flex justify-between"><span className="text-gray-500">Claimed:</span><span className="font-semibold">{expAudit.claimed_years ?? '—'} yrs</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Calculated:</span><span className="font-semibold">{expAudit.calculated_years ?? '—'} yrs</span></div>
                    {expDiff > 0 && (
                      <div className="flex justify-between"><span className="text-gray-500">Difference:</span>
                        <span className={`font-bold ${expDiff > 1 ? 'text-red-600' : 'text-amber-600'}`}>{expDiff > 0 ? '+' : ''}{expAudit.difference_years} yrs</span>
                      </div>
                    )}
                    <div className="flex justify-between"><span className="text-gray-500">Verdict:</span>
                      <span className={`font-bold ${expAudit.verdict === 'Match' ? 'text-green-600' : 'text-red-600'}`}>{expAudit.verdict ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )}
              {totalMissingMonths > 0 && (
                <div className="p-4">
                  <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Employment Gaps
                  </p>
                  <p className="text-xs text-gray-600 mb-2"><span className="font-bold text-orange-700">{totalMissingMonths}</span> month{totalMissingMonths !== 1 ? 's' : ''} unexplained</p>
                  {gaps.length > 0 && (
                    <ul className="space-y-1">
                      {gaps.slice(0, 3).map((g, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-orange-400 flex-shrink-0 mt-0.5">—</span>
                          <span>{g.from} → {g.to}{g.months ? ` (${g.months}mo)` : ''}{g.reason ? `: ${g.reason}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Required Actions (new AI schema) ─── */}
          {(r.required_actions?.length ?? 0) > 0 && (
            <div className="p-4 border-t border-gray-100 bg-blue-50/30">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Required Actions
              </p>
              <ul className="space-y-1.5">
                {r.required_actions!.map((a, i) => (
                  <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold flex-shrink-0 mt-px">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Strengths & Weaknesses Table ─── */}
          {(strengths.length > 0 || weaknesses.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-gray-100">
              {strengths.length > 0 && (
                <div className="p-4 border-r border-gray-100 bg-emerald-50/30">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Strengths
                  </p>
                  <ul className="space-y-2">
                    {strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-emerald-500 font-bold flex-shrink-0 mt-px">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {weaknesses.length > 0 && (
                <div className="p-4 bg-red-50/20">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Gaps & Weaknesses
                  </p>
                  <ul className="space-y-2">
                    {weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-red-400 font-bold flex-shrink-0 mt-px">×</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── AI Reasoning ─── */}
          {ev?.justification && (
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-500" /> AI Reasoning
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">{ev?.justification}</p>
            </div>
          )}

          {/* ── Risk Note ─── */}
          {ev?.risk_explanation && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 mt-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800"><span className="font-semibold">Risk Note: </span>{ev?.risk_explanation}</p>
              </div>
            </div>
          )}
        </>
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
      className={`bg-white border rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all select-none shadow-sm ${
        dragging ? 'opacity-40 border-indigo-400 scale-95 shadow-md' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
      }`}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
            {c.candidate_name?.[0] ?? '?'}
          </div>
          <div className="min-w-0 cursor-pointer" onClick={e => { e.stopPropagation(); onOpen(c) }}>
            <p className="text-xs font-semibold text-gray-900 truncate hover:text-indigo-600">{c.candidate_name}</p>
            <p className="text-[10px] text-gray-500 truncate">{c.candidate_email}</p>
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className="mt-1.5">
        <MatchBadge category={c.match_category} score={c.ai_score} />
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-500 mb-1 font-medium">Move to:</p>
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
              <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{s}</span>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 font-mono">{c.short_id ?? c.id.slice(0,8)} · {fmtDate(c.created_at)}</p>
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
              {c.created_at && (
                <span className="text-xs text-gray-500 font-mono">Uploaded: {fmtDate(c.created_at)}</span>
              )}
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-2 border-t border-white/5">
              {c.file_name && (
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{c.file_name}</span>
              )}
              {c.source_type && c.source_type !== 'direct_upload' && (
                <span className="capitalize bg-white/5 px-1.5 py-0.5 rounded text-gray-500">via {c.source_type.replace('_', ' ')}</span>
              )}
              <span className="font-mono text-gray-500">ID: {c.short_id ?? c.id.slice(0, 8)}</span>
              <span>Added: {fmtDate(c.created_at)}</span>
              {c.updated_at && c.updated_at !== c.created_at && (
                <span>Updated: {fmtDate(c.updated_at)}</span>
              )}
              {c.last_contacted_at && (
                <span>Last contacted: {fmtDate(c.last_contacted_at)}</span>
              )}
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
