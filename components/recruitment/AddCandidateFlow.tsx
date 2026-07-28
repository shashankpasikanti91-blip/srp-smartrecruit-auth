'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, FileText, Loader2, Sparkles, Upload, UserPlus, X, AlertTriangle,
} from 'lucide-react'
import { DuplicateCandidateModal } from '@/components/candidates/DuplicateCandidateModal'
import type { DuplicateMatch } from '@/lib/duplicateCheckTypes'

type JobOpt = { id: string; title: string; short_id?: string }
type Path = 'chooser' | 'upload' | 'paste' | 'manual' | 'review'

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | null

type CandForm = {
  candidate_name: string
  first_name: string
  last_name: string
  candidate_email: string
  candidate_phone: string
  location: string
  current_title: string
  current_company: string
  total_experience: string
  experience_summary: string
  ai_skills: string
  education: string
  nric: string
  passport_number: string
  nationality: string
  dob: string
  gender: string
  marital_status: string
  address: string
  linkedin_url: string
  portfolio_url: string
  source_channel: string
  job_post_id: string
}

type ConfMap = Partial<Record<keyof CandForm, Confidence>>

const emptyForm = (): CandForm => ({
  candidate_name: '', first_name: '', last_name: '', candidate_email: '', candidate_phone: '',
  location: '', current_title: '', current_company: '', total_experience: '', experience_summary: '',
  ai_skills: '', education: '', nric: '', passport_number: '', nationality: '',
  dob: '', gender: '', marital_status: '', address: '', linkedin_url: '', portfolio_url: '',
  source_channel: '', job_post_id: '',
})

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white'
import { candidateFieldLabel } from '@/lib/candidateFieldLabels'

const labelCls = 'text-xs font-extrabold text-slate-800 mb-1 flex items-center gap-2'

function ConfBadge({ c }: { c?: Confidence }) {
  if (!c) return null
  const colors = {
    HIGH: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    MEDIUM: 'bg-amber-100 text-amber-900 border-amber-200',
    LOW: 'bg-rose-100 text-rose-800 border-rose-200',
  }
  return <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${colors[c]}`}>{c}</span>
}

const SOURCES = [
  'Job Portal — JobStreet', 'Job Portal — LinkedIn', 'Job Portal — Monster', 'Job Portal — Indeed',
  'Referral', 'Direct application', 'Internal talent pool', 'Agency', 'Other',
]

export function AddCandidateFlow({
  open,
  onClose,
  onCreated,
  jobs,
  onViewCandidate,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
  jobs: JobOpt[]
  onViewCandidate?: (id: string) => void
}) {
  const [path, setPath] = useState<Path>('chooser')
  const [form, setForm] = useState<CandForm>(emptyForm)
  const [conf, setConf] = useState<ConfMap>({})
  const [rawText, setRawText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dup, setDup] = useState<{ id: string; short_id: string; name?: string } | null>(null)
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([])
  const [showDupModal, setShowDupModal] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (!open) return
    setPath('chooser')
    setForm(emptyForm())
    setConf({})
    setRawText('')
    setFile(null)
    setPasteText('')
    setWarnings([])
    setReviewMsg(null)
    setError(null)
    setDup(null)
    setDupMatches([])
    setShowDupModal(false)
  }, [open])

  const setF = <K extends keyof CandForm>(k: K, v: CandForm[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const applyFields = (fields: Record<string, { value?: string | null; confidence?: Confidence }>, text: string) => {
    const next = emptyForm()
    const nextConf: ConfMap = {}
    const map: [keyof CandForm, string][] = [
      ['candidate_name', 'name'], ['first_name', 'first_name'], ['last_name', 'last_name'],
      ['candidate_email', 'email'], ['candidate_phone', 'phone'], ['location', 'location'],
      ['current_title', 'current_title'], ['current_company', 'current_company'],
      ['total_experience', 'total_experience'], ['experience_summary', 'experience_summary'],
      ['ai_skills', 'skills'], ['education', 'education'], ['nric', 'nric'],
      ['passport_number', 'passport_number'], ['nationality', 'nationality'],
      ['linkedin_url', 'linkedin_url'],
    ]
    for (const [fk, sk] of map) {
      const f = fields[sk]
      if (f?.value) {
        next[fk] = f.value
        nextConf[fk] = f.confidence ?? null
      }
    }
    if (!next.candidate_name && (next.first_name || next.last_name)) {
      next.candidate_name = [next.first_name, next.last_name].filter(Boolean).join(' ')
    }
    setForm(next)
    setConf(nextConf)
    setRawText(text)
  }

  const runParse = async (opts: { file?: File; text?: string; improve?: boolean }) => {
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    // Fast hybrid path should finish in seconds; AI improve needs longer
    const ms = opts.improve ? 90_000 : 45_000
    const timer = setTimeout(() => ac.abort(), ms)
    try {
      let res: Response
      if (opts.file) {
        const fd = new FormData()
        fd.append('file', opts.file)
        if (opts.improve) fd.append('improve_with_ai', '1')
        res = await fetch('/api/candidates/parse-profile', { method: 'POST', body: fd, signal: ac.signal })
      } else {
        res = await fetch('/api/candidates/parse-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: opts.text, improve_with_ai: opts.improve }),
          signal: ac.signal,
        })
      }
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Parse failed'); return }
      applyFields(data.fields ?? {}, data.text ?? opts.text ?? '')
      setWarnings(data.fields?.warnings ?? [])
      setReviewMsg(data.message ?? 'Fields extracted — review below.')
      setPath('review')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError('Parse timed out. Try a shorter PDF/DOCX, or paste resume text instead.')
        return
      }
      const msg = e instanceof Error ? e.message : 'Network error'
      setError(`Parse failed: ${msg}. Try PDF/DOCX/TXT or paste text instead.`)
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  const improveWithAi = () => runParse({ text: rawText || pasteText, improve: true, file: file || undefined })

  const save = async (asDraft: boolean) => {
    if (!form.candidate_name.trim()) { setError('Full name is required'); return }
    setSaving(true)
    setError(null)
    setDup(null)
    setDupMatches([])
    try {
      // Preflight duplicate check (email / phone / passport / LinkedIn / resume hash)
      const checkRes = await fetch('/api/candidates/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.candidate_email.trim() || undefined,
          phone: form.candidate_phone.trim() || undefined,
          passport: form.passport_number.trim() || undefined,
          linkedin: form.linkedin_url.trim() || undefined,
          resume_text: rawText || pasteText || undefined,
        }),
      })
      const checkData = await checkRes.json().catch(() => ({}))
      if (checkRes.ok && checkData.is_duplicate && Array.isArray(checkData.duplicates) && checkData.duplicates.length > 0) {
        setDupMatches(checkData.duplicates)
        setShowDupModal(true)
        setDup(checkData.duplicates[0]
          ? { id: checkData.duplicates[0].id, short_id: checkData.duplicates[0].short_id, name: checkData.duplicates[0].candidate_name }
          : null)
        return
      }

      const payload = {
        candidate_name: form.candidate_name.trim(),
        candidate_email: form.candidate_email.trim() || undefined,
        candidate_phone: form.candidate_phone.trim() || undefined,
        job_post_id: form.job_post_id || undefined,
        ai_skills: form.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
        raw_text: rawText || pasteText || undefined,
        file_name: file?.name,
        file_size_bytes: file?.size,
        status: asDraft ? 'pending' : 'reviewed',
        candidate_profile: {
          current_title: form.current_title || null,
          current_company: form.current_company || null,
          current_location: form.location || null,
          total_experience: form.total_experience || null,
          experience_summary: form.experience_summary || null,
          education: form.education || null,
          nric: form.nric || null,
          passport_number: form.passport_number || null,
          nationality: form.nationality || null,
          dob: form.dob || null,
          gender: form.gender || null,
          marital_status: form.marital_status || null,
          address: form.address || null,
          linkedin_url: form.linkedin_url || null,
          portfolio_url: form.portfolio_url || null,
          source_channel: form.source_channel || null,
          id_document_type: form.nric
            ? (form.nationality.toLowerCase().includes('singapore') ? 'NRIC/FIN'
              : form.nationality.toLowerCase().includes('india') ? 'Aadhaar/PAN'
              : form.nationality.toLowerCase().includes('malay') || !form.nationality ? 'NRIC'
              : 'National ID')
            : form.passport_number ? 'Passport' : null,
          id_document_reference: form.nric || form.passport_number || null,
        },
      }
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.status === 409 && data.is_duplicate) {
        const existing = data.existing
        if (existing?.id) {
          setDupMatches([{
            id: existing.id,
            short_id: existing.short_id ?? existing.id.slice(0, 8),
            candidate_name: existing.name ?? existing.candidate_name ?? 'Existing candidate',
            candidate_email: existing.candidate_email ?? form.candidate_email ?? null,
            pipeline_stage: existing.pipeline_stage ?? '',
            status: existing.status ?? '',
            created_at: existing.created_at ?? new Date().toISOString(),
            client_name: existing.client_name ?? null,
            owner_name: existing.owner_name ?? null,
            owner_email: existing.owner_email ?? null,
            matched_on: existing.matched_on ?? ['email'],
          }])
          setShowDupModal(true)
        }
        setDup(existing)
        return
      }
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      const newId = data.candidate?.id as string | undefined
      if (newId && file) {
        const fd = new FormData()
        fd.append('file', file)
        await fetch(`/api/candidates/${newId}/resume-file`, { method: 'POST', body: fd }).catch(() => null)
      }
      onCreated(form.candidate_name.trim())
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
      {showDupModal && dupMatches.length > 0 && (
        <DuplicateCandidateModal
          duplicates={dupMatches}
          onClose={() => setShowDupModal(false)}
          onCancelCreate={() => { setShowDupModal(false); onClose() }}
          onView={(id) => {
            setShowDupModal(false)
            onClose()
            if (onViewCandidate) onViewCandidate(id)
            else window.location.href = `/dashboard/candidates/${id}`
          }}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col border border-slate-200" style={{ maxHeight: '94vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Candidates › New › {path === 'chooser' ? 'Choose path' : path}
            </p>
            <h2 className="text-base font-extrabold text-slate-900 mt-0.5">Add Candidate</h2>
            <p className="text-xs font-medium text-slate-500">Each flow has a review step before saving.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</div>}
          {dup && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
              Duplicate: {dup.name || 'Existing'} ({dup.short_id})
            </div>
          )}

          {path === 'chooser' && (
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { id: 'upload' as const, title: 'Upload Resume & Parse', desc: 'Upload PDF/DOC/DOCX. System extracts details. You review before saving.', color: 'border-emerald-200 bg-emerald-50/40', btn: 'bg-emerald-600 hover:bg-emerald-500', icon: Upload },
                { id: 'paste' as const, title: 'Paste Resume Text & Parse', desc: 'Paste resume text. System extracts fields. You review before saving.', color: 'border-violet-200 bg-violet-50/40', btn: 'bg-violet-600 hover:bg-violet-500', icon: FileText },
                { id: 'manual' as const, title: 'Manual Candidate Entry', desc: 'Create profile manually without parsing.', color: 'border-slate-200 bg-slate-50', btn: 'bg-slate-800 hover:bg-slate-700', icon: UserPlus },
              ].map(c => (
                <div key={c.id} className={`rounded-2xl border-2 p-5 ${c.color}`}>
                  <c.icon className="w-8 h-8 text-slate-700 mb-3" />
                  <h3 className="text-sm font-extrabold text-slate-900">{c.title}</h3>
                  <p className="text-xs font-medium text-slate-600 mt-2 mb-4 leading-relaxed">{c.desc}</p>
                  <button type="button" onClick={() => setPath(c.id === 'manual' ? 'review' : c.id)}
                    className={`w-full py-2.5 rounded-lg text-white text-sm font-extrabold ${c.btn}`}>
                    {c.id === 'upload' ? 'Start Resume Upload' : c.id === 'paste' ? 'Start Text Parsing' : 'Enter Manually'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {path === 'upload' && (
            <div className="space-y-4 max-w-2xl mx-auto w-full">
              <button type="button" onClick={() => setPath('chooser')} className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
              <label className={`srp-dropzone ${loading ? 'is-drag' : ''} ${error ? 'is-err' : ''} ${file && !loading && !error ? 'is-ok' : ''}`}>
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setFile(f); runParse({ file: f }) }
                  }} />
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                ) : (
                  <div className="srp-dropzone-icon"><Upload className="w-5 h-5" /></div>
                )}
                <p className="srp-dropzone-title">{file ? file.name : 'Drop resume PDF / DOC / DOCX here'}</p>
                <p className="srp-dropzone-sub">
                  {loading
                    ? 'Extracting name, email, phone, skills, experience…'
                    : 'Hybrid parser extracts fields — you review before save'}
                </p>
              </label>
            </div>
          )}

          {path === 'paste' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <button type="button" onClick={() => setPath('chooser')} className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
              <textarea className={`${inputCls} min-h-[220px]`} value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="Paste full resume text here…" />
              <button type="button" disabled={loading || pasteText.length < 40} onClick={() => runParse({ text: pasteText })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-extrabold disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Parse Resume Text
              </button>
            </div>
          )}

          {path === 'review' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setPath('chooser')} className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Change path</button>
                {rawText && (
                  <button type="button" onClick={improveWithAi} disabled={loading}
                    className="text-xs font-extrabold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 disabled:opacity-50">
                    <Sparkles className="w-3.5 h-3.5" /> Improve with AI
                  </button>
                )}
              </div>

              {reviewMsg && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {reviewMsg}
                </div>
              )}
              {warnings.map((w, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{w}</div>
              ))}
              {file && (
                <p className="text-xs font-bold text-emerald-700">{file.name} — Fields extracted — review below.</p>
              )}
              {rawText && (
                <button type="button" onClick={() => setShowRaw(s => !s)} className="text-xs font-bold text-indigo-600 underline">
                  {showRaw ? 'Hide' : 'View'} extracted resume text
                </button>
              )}
              {showRaw && (
                <pre className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{rawText.slice(0, 4000)}</pre>
              )}

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Basic & contact</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    ['candidate_name', 'Full name *'],
                    ['first_name', 'First name'],
                    ['last_name', 'Last name'],
                    ['candidate_email', 'Email'],
                    ['candidate_phone', 'Phone'],
                    ['location', 'Location (city/state)'],
                  ] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className={labelCls}>{label} <ConfBadge c={conf[k]} /></label>
                      <input className={inputCls} value={form[k]} onChange={e => setF(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Role & Experience</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    ['current_title', 'Current role / title'],
                    ['current_company', 'Current company'],
                    ['total_experience', 'Years of experience'],
                  ] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className={labelCls}>{label} <ConfBadge c={conf[k]} /></label>
                      <input className={inputCls} value={form[k]} onChange={e => setF(k, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className={labelCls}>Experience summary <ConfBadge c={conf.experience_summary} /></label>
                  <textarea className={`${inputCls} min-h-[70px]`} value={form.experience_summary} onChange={e => setF('experience_summary', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Skills (comma-separated) <ConfBadge c={conf.ai_skills} /></label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={form.ai_skills} onChange={e => setF('ai_skills', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Qualifications / Education <ConfBadge c={conf.education} /></label>
                  <textarea className={`${inputCls} min-h-[70px]`} value={form.education} onChange={e => setF('education', e.target.value)} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Identity & Personal</p>
                <p className="text-[11px] text-slate-500">
                  Identity fields depend on nationality — Malaysia uses NRIC/IC, India uses Aadhaar/PAN, Singapore uses NRIC/FIN or passport. Set nationality first.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nationality <ConfBadge c={conf.nationality} /></label>
                    <input className={inputCls} value={form.nationality} onChange={e => setF('nationality', e.target.value)} placeholder="e.g. Malaysian, Indian, Singaporean" />
                  </div>
                  <div>
                    <label className={labelCls}>
                      {form.nationality.toLowerCase().includes('india')
                        ? 'Aadhaar / PAN reference'
                        : form.nationality.toLowerCase().includes('singapore')
                          ? 'NRIC / FIN'
                          : form.nationality.toLowerCase().includes('malay') || !form.nationality
                            ? candidateFieldLabel('nric')
                            : 'National ID / local ID'}
                      {' '}<ConfBadge c={conf.nric} />
                    </label>
                    <input
                      className={inputCls}
                      value={form.nric}
                      onChange={e => setF('nric', e.target.value)}
                      placeholder={
                        form.nationality.toLowerCase().includes('india') ? 'PAN or Aadhaar ref'
                        : form.nationality.toLowerCase().includes('singapore') ? 'NRIC / FIN'
                        : '901231-10-5678'
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{candidateFieldLabel('passport_number')} <ConfBadge c={conf.passport_number} /></label>
                    <input className={inputCls} value={form.passport_number} onChange={e => setF('passport_number', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" className={inputCls} value={form.dob} onChange={e => setF('dob', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select className={inputCls} value={form.gender} onChange={e => setF('gender', e.target.value)}>
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Marital Status</label>
                    <select className={inputCls} value={form.marital_status} onChange={e => setF('marital_status', e.target.value)}>
                      <option value="">—</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Full Address</label>
                  <textarea className={`${inputCls} min-h-[50px]`} value={form.address} onChange={e => setF('address', e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>LinkedIn URL <ConfBadge c={conf.linkedin_url} /></label>
                    <input className={inputCls} value={form.linkedin_url} onChange={e => setF('linkedin_url', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Portfolio URL</label>
                    <input className={inputCls} value={form.portfolio_url} onChange={e => setF('portfolio_url', e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Source & Job</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Where was this candidate sourced from?</label>
                    <select className={inputCls} value={form.source_channel} onChange={e => setF('source_channel', e.target.value)}>
                      <option value="">— Select —</option>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Link to Job Opening</label>
                    <select className={inputCls} value={form.job_post_id} onChange={e => setF('job_post_id', e.target.value)}>
                      <option value="">— Select job —</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.short_id ?? j.id.slice(0, 8)})</option>)}
                    </select>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {path === 'review' && (
          <div className="flex flex-wrap justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700">Cancel</button>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => save(true)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-800 disabled:opacity-50">
                Save as draft
              </button>
              <button type="button" disabled={saving || !form.candidate_name} onClick={() => save(false)}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold disabled:opacity-50">
                {saving ? 'Saving…' : 'Save candidate (reviewed)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
