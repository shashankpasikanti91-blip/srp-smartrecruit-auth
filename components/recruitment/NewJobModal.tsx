'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Loader2, Sparkles, X, Plus } from 'lucide-react'

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

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white'
const labelCls = 'text-xs font-extrabold text-slate-800 mb-1.5 block'

export function NewJobModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (job: Record<string, unknown>, generatePosts?: boolean) => void
}) {
  const [form, setForm] = useState<JobForm>(emptyForm)
  const [clients, setClients] = useState<Client[]>([])
  const [jdMode, setJdMode] = useState<'text' | 'file'>('text')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [skillDraft, setSkillDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof JobForm>(key: K, value: JobForm[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setMsg(null)
    setError(null)
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.clients ?? [])).catch(() => setClients([]))
  }, [open])

  const selectedClient = clients.find(c => c.id === form.client_id)

  const parseJd = async (mode: 'ai' | 'manual') => {
    const text = form.raw_jd_text || form.description
    if (!text.trim()) { setError('Paste the JD text first'); return }
    setParsing(true)
    setError(null)
    setMsg(null)
    try {
      const res = await fetch('/api/jobs/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      })
      const data = await res.json()
      if (!res.ok && !data.fields) {
        setError(data.error ?? 'Parse failed')
        return
      }
      const f = data.fields ?? {}
      setForm(p => ({
        ...p,
        title: f.title || p.title,
        company: f.company || p.company || selectedClient?.name || '',
        location: f.location || p.location,
        department: f.department || p.department,
        type: f.type || p.type,
        contract_duration: f.contract_duration || p.contract_duration,
        experience_min: f.experience_min != null ? String(f.experience_min) : p.experience_min,
        experience_max: f.experience_max != null ? String(f.experience_max) : p.experience_max,
        salary_min: f.salary_min != null ? String(f.salary_min) : p.salary_min,
        salary_max: f.salary_max != null ? String(f.salary_max) : p.salary_max,
        currency: f.currency || p.currency,
        description: f.description || p.description,
        requirements: f.requirements || p.requirements,
        optional_requirements: f.optional_requirements || p.optional_requirements,
        raw_jd_text: f.raw_jd_text || text,
        skills_mandatory: f.skills_mandatory?.length ? f.skills_mandatory : p.skills_mandatory,
        skills_required: f.skills_required?.length ? f.skills_required : p.skills_required,
        priority: f.priority || p.priority,
        headcount: f.headcount != null ? String(f.headcount) : p.headcount,
        candidate_type: f.candidate_type || p.candidate_type,
        max_budget: f.max_budget != null ? String(f.max_budget) : p.max_budget,
      }))
      setMsg(data.message ?? (mode === 'ai' ? 'Parsed with AI — review fields.' : 'Text kept without AI.'))
    } catch {
      setError('Network error')
    } finally {
      setParsing(false)
    }
  }

  const onFile = async (file: File) => {
    setParsing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not read file'); return }
      setForm(p => ({ ...p, raw_jd_text: data.text || '', description: data.text?.slice(0, 4000) || p.description }))
      setMsg(`Loaded "${file.name}" — click Parse with AI or Use text without AI.`)
    } catch {
      setError('File upload failed')
    } finally {
      setParsing(false)
    }
  }

  const save = async (generatePosts = false) => {
    if (!form.title.trim()) { setError('Job title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        company: form.company || selectedClient?.name || '',
        client_id: form.client_id || null,
        salary_min: form.salary_min || null,
        salary_max: form.salary_max || null,
        experience_min: form.experience_min || null,
        experience_max: form.experience_max || null,
        headcount: form.headcount || 1,
        target_cv_submissions: form.target_cv_submissions || null,
        internal_sla_days: form.internal_sla_days || 10,
        max_budget: form.max_budget || null,
        ai_generated: Boolean(form.raw_jd_text && form.title),
        tags: form.skills_mandatory,
      }
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Create failed'); return }
      onCreated(data.job, generatePosts)
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 overflow-y-auto flex items-start justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 flex flex-col border border-slate-200" style={{ maxHeight: '94vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center">
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
              <label className={labelCls}>Job Title <span className="text-red-500">*</span></label>
              <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Senior Software Engineer" />
            </div>
            <div>
              <label className={labelCls}>Client <span className="text-red-500">*</span></label>
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
              <label className={labelCls}>Contract / Employment Type</label>
              <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                {['full-time', 'part-time', 'contract', 'remote', 'internship'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract duration</label>
              <input className={inputCls} value={form.contract_duration} onChange={e => set('contract_duration', e.target.value)} placeholder="e.g. 10 months" />
            </div>
          </div>

          {/* JD paste / upload */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setJdMode('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${jdMode === 'text' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-200'}`}>
                Plain text
              </button>
              <button type="button" onClick={() => setJdMode('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${jdMode === 'file' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-200'}`}>
                Upload file(s)
              </button>
            </div>
            {jdMode === 'text' ? (
              <textarea className={`${inputCls} min-h-[120px]`} value={form.raw_jd_text}
                onChange={e => set('raw_jd_text', e.target.value)}
                placeholder="Paste the full job description here…" />
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-xl bg-white py-8 cursor-pointer hover:bg-indigo-50/40">
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
                <p className="text-sm font-bold text-slate-700">Drop JD — PDF / DOCX / TXT</p>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={parsing} onClick={() => parseJd('ai')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold disabled:opacity-50">
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Parse with AI
              </button>
              <button type="button" disabled={parsing} onClick={() => parseJd('manual')}
                className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Use text without AI
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Parse with AI fills title, skills, experience, and salary when possible. Use without AI if you will type those fields yourself.
            </p>
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
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Delivery & Timeline</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>JD received date <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={form.jd_received_date} onChange={e => set('jd_received_date', e.target.value)} />
                <p className="text-[10px] font-medium text-slate-500 mt-1">When the client JD landed</p>
              </div>
              <div>
                <label className={labelCls}>Priority <span className="text-red-500">*</span></label>
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
                <label className={labelCls}>Target submission date <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={form.target_submission_date} onChange={e => set('target_submission_date', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Max candidate budget</label>
                <input type="number" min={0} className={inputCls} value={form.max_budget} onChange={e => set('max_budget', e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <input type="checkbox" checked={form.share_jd_with_client} onChange={e => set('share_jd_with_client', e.target.checked)} />
              OK to share this JD text with the client (optional)
            </label>
          </div>

          {/* Assignment */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Who will work on this JD?</p>
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
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Required Skills</p>
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
                placeholder="Skill 1" onKeyDown={e => {
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
              }} className="px-3 py-2 rounded-lg text-sm font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 whitespace-nowrap">
                <Plus className="w-4 h-4 inline" /> Add Skill
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} min-h-[80px]`} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Requirements</label>
            <textarea className={`${inputCls} min-h-[60px]`} value={form.requirements} onChange={e => set('requirements', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700">Cancel</button>
          <button type="button" disabled={saving || !form.title} onClick={() => save(false)}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Job'}
          </button>
          <button type="button" disabled={saving || !form.title} onClick={() => save(true)}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-indigo-600 text-white text-sm font-extrabold disabled:opacity-50">
            Create & Generate Posts
          </button>
        </div>
      </div>
    </div>
  )
}
