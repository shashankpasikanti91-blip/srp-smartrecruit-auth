'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Loader2, Sparkles, X, Plus } from 'lucide-react'
import {
  JOB_POST_PLATFORMS,
  JOB_POST_PLATFORM_META,
  type JobPostPlatform,
} from '@/lib/jobPostPlatforms'
import { parseUploadedFile } from '@/lib/parseFileClient'

type Client = { id: string; name: string }
type JobForm = {
  title: string
  company: string
  client_id: string
  department: string
  location: string
  type: string
  contract_duration: string
  currency: string
  salary_min: string
  salary_max: string
  experience_min: string
  experience_max: string
  headcount: string
  candidate_type: string
  description: string
  requirements: string
  optional_requirements: string
  raw_jd_text: string
  jd_received_date: string
  priority: string
  target_cv_submissions: string
  internal_sla_days: string
  target_submission_date: string
  share_jd_with_client: boolean
  assign_all_team: boolean
  skills_mandatory: string[]
  skills_required: string[]
  client_jr_no: string
  max_budget: string
}

const emptyForm = (): JobForm => {
  const today = new Date().toISOString().slice(0, 10)
  const plus5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  return {
    title: '', company: '', client_id: '', department: '', location: '',
    type: 'full-time', contract_duration: '', currency: 'MYR',
    salary_min: '0', salary_max: '0', experience_min: '0', experience_max: '0',
    headcount: '1', candidate_type: 'any',
    description: '', requirements: '', optional_requirements: '', raw_jd_text: '',
    jd_received_date: today, priority: 'medium', target_cv_submissions: '',
    internal_sla_days: '10', target_submission_date: plus5,
    share_jd_with_client: false, assign_all_team: false,
    skills_mandatory: [], skills_required: [],
    client_jr_no: '', max_budget: '',
  }
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 bg-white'
const labelCls = 'text-xs font-extrabold text-[#166534] mb-1.5 block'

export function NewJobModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (job: Record<string, unknown>, generatePosts?: boolean, platforms?: JobPostPlatform[]) => void
}) {
  const [form, setForm] = useState<JobForm>(emptyForm)
  const [clients, setClients] = useState<Client[]>([])
  const [jdMode, setJdMode] = useState<'text' | 'file'>('text')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [skillDraft, setSkillDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<JobPostPlatform[]>([...JOB_POST_PLATFORMS])
  const [pendingJdFile, setPendingJdFile] = useState<File | null>(null)

  const set = <K extends keyof JobForm>(key: K, value: JobForm[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setMsg(null)
    setError(null)
    setPendingJdFile(null)
    setSelectedPlatforms([...JOB_POST_PLATFORMS])
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.clients ?? [])).catch(() => setClients([]))
  }, [open])

  const selectedClient = clients.find(c => c.id === form.client_id)

  const togglePlatform = (p: JobPostPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? (prev.length === 1 ? prev : prev.filter(x => x !== p)) : [...prev, p]
    )
  }

  const applyParsedFields = (f: Record<string, unknown>, text: string, clientName?: string) => {
    setForm(p => ({
      ...p,
      title: (f.title as string) || p.title,
      company: (f.company as string) || p.company || clientName || '',
      location: (f.location as string) || p.location,
      department: (f.department as string) || p.department,
      type: (f.type as string) || p.type,
      contract_duration: (f.contract_duration as string) || p.contract_duration,
      experience_min: f.experience_min != null ? String(f.experience_min) : p.experience_min,
      experience_max: f.experience_max != null ? String(f.experience_max) : p.experience_max,
      salary_min: f.salary_min != null ? String(f.salary_min) : p.salary_min,
      salary_max: f.salary_max != null ? String(f.salary_max) : p.salary_max,
      currency: (f.currency as string) || p.currency,
      description: (f.description as string) || p.description,
      requirements: (f.requirements as string) || p.requirements,
      optional_requirements: (f.optional_requirements as string) || p.optional_requirements,
      raw_jd_text: (f.raw_jd_text as string) || text,
      skills_mandatory: Array.isArray(f.skills_mandatory) && f.skills_mandatory.length
        ? (f.skills_mandatory as string[])
        : p.skills_mandatory,
      skills_required: Array.isArray(f.skills_required) && f.skills_required.length
        ? (f.skills_required as string[])
        : p.skills_required,
      priority: (f.priority as string) || p.priority,
      headcount: f.headcount != null ? String(f.headcount) : p.headcount,
      candidate_type: (f.candidate_type as string) || p.candidate_type,
      max_budget: f.max_budget != null ? String(f.max_budget) : p.max_budget,
    }))
  }

  const parseJdText = async (
    text: string,
    mode: 'ai' | 'manual',
    opts?: { silent?: boolean }
  ): Promise<Record<string, unknown> | null> => {
    if (!text.trim()) {
      if (!opts?.silent) setError('Paste the JD text first')
      return null
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 50_000)
    let res: Response
    try {
      res = await fetch('/api/jobs/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (!opts?.silent) setError('JD parse timed out. Try again, or fill fields manually.')
        return null
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
    const data = await res.json()
    if (!res.ok && !data.fields) {
      if (!opts?.silent) setError(data.error ?? 'Parse failed')
      return null
    }
    return (data.fields ?? {}) as Record<string, unknown>
  }

  const parseJd = async (mode: 'ai' | 'manual') => {
    const text = form.raw_jd_text || form.description
    setParsing(true)
    setError(null)
    setMsg(null)
    try {
      const f = await parseJdText(text, mode)
      if (!f) return
      applyParsedFields(f, text, selectedClient?.name)
      setMsg(mode === 'ai'
        ? 'Parsed with AI — About Role, Responsibilities, Requirements & Skills filled. Review then Create.'
        : 'Text kept without AI.')
    } catch {
      setError('Network error')
    } finally {
      setParsing(false)
    }
  }

  const onFile = async (file: File) => {
    setParsing(true)
    setError(null)
    setMsg(null)
    setPendingJdFile(file)
    try {
      const data = await parseUploadedFile(file)
      const text = String(data.text || '')
      setForm(p => ({ ...p, raw_jd_text: text }))
      if (text.trim().length < 40) {
        setMsg(`Loaded "${file.name}" — raw JD saved (short). Add more text or parse manually.`)
        return
      }
      setMsg(`Loaded "${file.name}" — parsing JD into recruiter fields…`)
      const f = await parseJdText(text, 'ai', { silent: true })
      if (f) {
        applyParsedFields(f, text, selectedClient?.name)
        setMsg(`Loaded & parsed "${file.name}" — review About Role, Requirements & Skills, then Create.`)
      } else {
        setMsg(`Loaded "${file.name}" — raw JD saved. Click Parse with AI if fields look empty.`)
      }
    } catch {
      setError('File upload failed')
    } finally {
      setParsing(false)
    }
  }

  const save = async (generatePosts = false) => {
    if (generatePosts && selectedPlatforms.length === 0) {
      setError('Select at least one channel (Email, LinkedIn, WhatsApp…) for post generation')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let working = { ...form }
      const rawJd = (working.raw_jd_text || '').trim() || (working.description || '').trim() || null
      const needsParse = Boolean(rawJd && rawJd.length >= 40 && (!working.description.trim() || !working.requirements.trim()))
      if (needsParse) {
        setMsg('Parsing JD before save…')
        const f = await parseJdText(rawJd!, 'ai', { silent: true })
        if (f) {
          working = {
            ...working,
            title: (f.title as string) || working.title,
            company: (f.company as string) || working.company || selectedClient?.name || '',
            location: (f.location as string) || working.location,
            department: (f.department as string) || working.department,
            type: (f.type as string) || working.type,
            contract_duration: (f.contract_duration as string) || working.contract_duration,
            experience_min: f.experience_min != null ? String(f.experience_min) : working.experience_min,
            experience_max: f.experience_max != null ? String(f.experience_max) : working.experience_max,
            salary_min: f.salary_min != null ? String(f.salary_min) : working.salary_min,
            salary_max: f.salary_max != null ? String(f.salary_max) : working.salary_max,
            currency: (f.currency as string) || working.currency,
            description: (f.description as string) || working.description,
            requirements: (f.requirements as string) || working.requirements,
            optional_requirements: (f.optional_requirements as string) || working.optional_requirements,
            raw_jd_text: (f.raw_jd_text as string) || rawJd!,
            skills_mandatory: Array.isArray(f.skills_mandatory) && f.skills_mandatory.length
              ? (f.skills_mandatory as string[])
              : working.skills_mandatory,
            skills_required: Array.isArray(f.skills_required) && f.skills_required.length
              ? (f.skills_required as string[])
              : working.skills_required,
            priority: (f.priority as string) || working.priority,
            headcount: f.headcount != null ? String(f.headcount) : working.headcount,
            candidate_type: (f.candidate_type as string) || working.candidate_type,
            max_budget: f.max_budget != null ? String(f.max_budget) : working.max_budget,
          }
          setForm(working)
        }
      }
      if (!working.title.trim()) {
        setError('Job title is required — paste/upload a JD and wait for parse, or type a title')
        return
      }
      if (!working.client_id) {
        setError('Select a client before creating the job')
        return
      }
      // Always keep the original pasted/uploaded JD alongside structured fields
      const payload = {
        ...working,
        company: working.company || selectedClient?.name || '',
        client_id: working.client_id || null,
        salary_min: working.salary_min || null,
        salary_max: working.salary_max || null,
        experience_min: working.experience_min || null,
        experience_max: working.experience_max || null,
        headcount: working.headcount || 1,
        target_cv_submissions: working.target_cv_submissions || null,
        internal_sla_days: working.internal_sla_days || 10,
        max_budget: working.max_budget || null,
        raw_jd_text: rawJd,
        ai_generated: Boolean(rawJd && working.title),
        tags: working.skills_mandatory,
      }
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Create failed'); return }
      const jobId = (data.job as { id?: string } | undefined)?.id
      if (jobId && pendingJdFile) {
        try {
          const fd = new FormData()
          fd.append('file', pendingJdFile)
          await fetch(`/api/jobs/${jobId}/jd-file`, { method: 'POST', body: fd })
        } catch { /* text JD already saved; binary is best-effort */ }
      }
      onCreated(data.job, generatePosts, generatePosts ? selectedPlatforms : undefined)
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 overflow-y-auto overflow-x-clip flex items-start justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-2 sm:my-4 flex flex-col border border-slate-200 min-w-0" style={{ maxHeight: 'min(94vh, calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom)))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#166534] flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">New client requirement</h2>
              <p className="text-xs font-medium text-slate-500">Pick a client, paste/upload JD, Parse with AI or fill manually.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</div>}
          {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">{msg}</div>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Job Title <span className="text-[#F97316]">*</span></label>
              <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Senior Software Engineer" />
            </div>
            <div>
              <label className={labelCls}>Client <span className="text-[#F97316]">*</span></label>
              <select className={inputCls} value={form.client_id}
                onChange={e => {
                  const id = e.target.value
                  const c = clients.find(x => x.id === id)
                  setForm(p => ({ ...p, client_id: id, company: c?.name || p.company }))
                }}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[10px] font-medium text-slate-500 mt-1">Every JD is stored under a client.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Employment type</label>
              <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="full-time">Permanent / Full-time</option>
                <option value="contract">Contract</option>
                <option value="part-time">Part-time</option>
                <option value="remote">Remote</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract duration</label>
              <input className={inputCls} value={form.contract_duration} onChange={e => set('contract_duration', e.target.value)} placeholder="e.g. 10 months (if contract)" />
            </div>
          </div>

          {/* JD paste / upload */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setJdMode('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${jdMode === 'text' ? 'bg-[#166534] text-white border-[#14532d]' : 'bg-white text-slate-700 border-slate-200'}`}>
                Plain text
              </button>
              <button type="button" onClick={() => setJdMode('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${jdMode === 'file' ? 'bg-[#166534] text-white border-[#14532d]' : 'bg-white text-slate-700 border-slate-200'}`}>
                Upload file(s)
              </button>
            </div>
            {jdMode === 'text' ? (
              <textarea className={`${inputCls} min-h-[120px]`} value={form.raw_jd_text}
                onChange={e => set('raw_jd_text', e.target.value)}
                placeholder="Paste the full job description here…" />
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#166534]/30 rounded-xl bg-white py-8 cursor-pointer hover:bg-[#ecfdf3]">
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
                <p className="text-sm font-bold text-slate-700">Drop JD — PDF / DOC / DOCX / TXT</p>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Legacy Word .doc files are supported</p>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={parsing} onClick={() => parseJd('ai')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#ea580c] text-white text-sm font-extrabold disabled:opacity-50">
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Parse with AI
              </button>
              <button type="button" disabled={parsing} onClick={() => parseJd('manual')}
                className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Keep raw JD only
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Upload auto-parses the JD. Or paste text and click Parse with AI. Fields fill for About Role, Responsibilities, Requirements, Key Skills, Location, Type & Budget. Raw JD is always saved. Create also auto-parses if those fields are still empty.
            </p>
            {form.raw_jd_text.trim().length > 40 && (
              <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-extrabold text-slate-700">
                  Raw JD saved ({form.raw_jd_text.trim().length.toLocaleString()} chars) — click to preview
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600 leading-relaxed">
                  {form.raw_jd_text.slice(0, 4000)}
                  {form.raw_jd_text.length > 4000 ? '\n…' : ''}
                </pre>
              </details>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Kuala Lumpur" />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="Select / type department" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Min Experience (years)</label>
              <input type="number" min={0} className={inputCls} value={form.experience_min} onChange={e => set('experience_min', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Max Experience (years)</label>
              <input type="number" min={0} className={inputCls} value={form.experience_max} onChange={e => set('experience_max', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['MYR', 'SGD', 'INR', 'USD', 'AED', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Min salary (monthly)</label>
              <input type="number" min={0} className={inputCls} value={form.salary_min} onChange={e => set('salary_min', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Max salary (monthly)</label>
              <input type="number" min={0} className={inputCls} value={form.salary_max} onChange={e => set('salary_max', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Open roles</label>
              <input type="number" min={1} className={inputCls} value={form.headcount} onChange={e => set('headcount', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Candidate type</label>
              <select className={inputCls} value={form.candidate_type} onChange={e => set('candidate_type', e.target.value)}>
                {['any', 'local', 'foreign', 'fresh_graduate', 'experienced'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Client JR No.</label>
              <input className={inputCls} value={form.client_jr_no} onChange={e => set('client_jr_no', e.target.value)} placeholder="Optional client requisition #" />
            </div>
          </div>

          {/* Delivery & Timeline */}
          <div className="rounded-xl border border-slate-200 bg-amber-50/30 p-4 space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#166534]">Delivery & Timeline</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>JD received date <span className="text-[#F97316]">*</span></label>
                <input type="date" className={inputCls} value={form.jd_received_date} onChange={e => set('jd_received_date', e.target.value)} />
                <p className="text-[10px] font-medium text-slate-500 mt-1">When the client JD landed</p>
              </div>
              <div>
                <label className={labelCls}>Priority <span className="text-[#F97316]">*</span></label>
                <select className={inputCls} value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <p className="text-[10px] font-medium text-slate-500 mt-1">HIGH appears in priority alerts</p>
              </div>
              <div>
                <label className={labelCls}>Target CV submissions</label>
                <input className={inputCls} value={form.target_cv_submissions} onChange={e => set('target_cv_submissions', e.target.value)} placeholder="e.g. 5" />
              </div>
              <div>
                <label className={labelCls}>Internal SLA (days)</label>
                <input type="number" min={1} className={inputCls} value={form.internal_sla_days} onChange={e => set('internal_sla_days', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Target submission date <span className="text-[#F97316]">*</span></label>
                <input type="date" className={inputCls} value={form.target_submission_date} onChange={e => set('target_submission_date', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Budget / Max budget</label>
                <input type="number" min={0} className={inputCls} value={form.max_budget} onChange={e => set('max_budget', e.target.value)} placeholder="Optional monthly / package" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <input type="checkbox" checked={form.share_jd_with_client} onChange={e => set('share_jd_with_client', e.target.checked)} />
              OK to share this JD text with the client (optional)
            </label>
          </div>

          {/* Assignment */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#166534]">Who will work on this JD?</p>
            <p className="text-xs font-medium text-slate-500">Choose all team members on this client, or pick specific recruiters.</p>
            {!form.client_id && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                Select a client first to load your team list.
              </div>
            )}
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <input type="checkbox" checked={form.assign_all_team} onChange={e => set('assign_all_team', e.target.checked)} />
              All team — every recruiter on this client account
            </label>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#166534]">Key Skills</p>
            <p className="text-[11px] font-medium text-slate-500">Must-have hard skills for screening (Java, Spring, SQL…)</p>
            <div className="flex flex-wrap gap-1.5">
              {form.skills_mandatory.map(s => (
                <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                  {s}
                  <button type="button" className="text-amber-700" onClick={() => setForm(p => ({ ...p, skills_mandatory: p.skills_mandatory.filter(x => x !== s) }))}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} value={skillDraft} onChange={e => setSkillDraft(e.target.value)}
                placeholder="Add a key skill" onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const s = skillDraft.trim()
                    if (s && !form.skills_mandatory.includes(s)) {
                      setForm(p => ({ ...p, skills_mandatory: [...p.skills_mandatory, s] }))
                      setSkillDraft('')
                    }
                  }
                }} />
              <button type="button" onClick={() => {
                const s = skillDraft.trim()
                if (s && !form.skills_mandatory.includes(s)) {
                  setForm(p => ({ ...p, skills_mandatory: [...p.skills_mandatory, s] }))
                  setSkillDraft('')
                }
              }} className="px-3 py-2 rounded-lg text-sm font-extrabold text-[#166534] bg-[#ecfdf3] border border-[#166534]/20 whitespace-nowrap">
                <Plus className="w-4 h-4 inline" /> Add Skill
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>About the Role &amp; Responsibilities</label>
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">Short about + key responsibilities bullets (recruiter view — not a long brochure)</p>
            <textarea
              className={`${inputCls} min-h-[120px]`}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={'About the Role\n2–4 sentences…\n\nKey Responsibilities\n• …\n• …'}
            />
          </div>
          <div>
            <label className={labelCls}>Requirements</label>
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">Must-have experience, education, tools</p>
            <textarea
              className={`${inputCls} min-h-[90px]`}
              value={form.requirements}
              onChange={e => set('requirements', e.target.value)}
              placeholder={'• 3+ years Java\n• Spring Boot\n• SQL'}
            />
          </div>

          <div className="rounded-xl border border-[#166534]/20 bg-[#ecfdf3]/60 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#166534]">Channel posts (Create & Generate)</p>
                <p className="text-[11px] font-medium text-[#14532d]/80 mt-0.5">
                  Email letter · LinkedIn hashtags · WhatsApp group msg · Indeed ATS — each uses a different prompt
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlatforms(prev => prev.length === JOB_POST_PLATFORMS.length ? ['linkedin'] : [...JOB_POST_PLATFORMS])}
                className="text-[11px] font-bold text-[#166534] hover:underline whitespace-nowrap"
              >
                {selectedPlatforms.length === JOB_POST_PLATFORMS.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {JOB_POST_PLATFORMS.map(p => {
                const meta = JOB_POST_PLATFORM_META[p]
                const on = selectedPlatforms.includes(p)
                return (
                  <label
                    key={p}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer bg-white ${on ? 'border-[#F97316]' : 'border-slate-200 opacity-80'}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => togglePlatform(p)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800">{meta.label}</span>
                      <span className="block text-[10px] text-slate-500">{meta.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700">Cancel</button>
          <button type="button" disabled={saving || !form.title} onClick={() => save(false)}
            className="px-5 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#ea580c] text-white text-sm font-extrabold disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Job'}
          </button>
          <button type="button" disabled={saving || !form.title} onClick={() => save(true)}
            className="px-5 py-2.5 rounded-lg bg-[#166534] hover:bg-[#14532d] text-white text-sm font-extrabold disabled:opacity-50">
            Create & Generate Posts
          </button>
        </div>
      </div>
    </div>
  )
}
