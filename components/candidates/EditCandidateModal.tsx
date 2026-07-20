'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, Save, AlertCircle } from 'lucide-react'
import { formatNric, nricToDob, nricToGender, isValidNric } from '@/lib/nric'
import {
  LIFECYCLE_STATUSES,
  LIFECYCLE_LABELS,
  HIRE_TYPES,
  HIRE_TYPE_LABELS,
  VISA_TYPES,
  VISA_TYPE_LABELS,
  INTERVIEW_MODES,
  type LifecycleStatus,
  type HireType,
  type VisaType,
} from '@/lib/candidateLifecycle'

export type EditableCandidate = {
  id: string
  short_id?: string | null
  candidate_name: string
  candidate_email: string
  candidate_phone?: string | null
  ai_skills?: string[] | null
  pipeline_stage?: string
  status?: string
  job_post_id?: string | null
  reviewer_notes?: string | null
  candidate_profile?: Record<string, string | null> | null
  job_posts?: { id: string; title: string; company?: string } | null
}

type JobOption = { id: string; title: string; company?: string | null }

type FormState = {
  candidate_name: string
  candidate_email: string
  candidate_phone: string
  ai_skills: string
  pipeline_stage: string
  status: string
  job_post_id: string
  reviewer_notes: string
  // profile
  nric: string
  passport_number: string
  nationality: string
  dob: string
  gender: string
  address: string
  current_company: string
  current_title: string
  current_location: string
  preferred_location: string
  total_experience: string
  relevant_experience: string
  current_salary: string
  expected_salary: string
  notice_period: string
  work_authorization: string
  visa_type: string
  visa_expiry: string
  hire_type: string
  client_name: string
  applying_for: string
  source_channel: string
  interview_mode: string
  offers_in_hand: string
  lifecycle_status: string
  education: string
  certifications: string
  notes: string
  follow_up_notes: string
  candidate_feedback: string
  internal_comments: string
  next_action: string
}

function fromCandidate(c: EditableCandidate): FormState {
  const p = c.candidate_profile ?? {}
  return {
    candidate_name: c.candidate_name ?? '',
    candidate_email: c.candidate_email ?? '',
    candidate_phone: c.candidate_phone ?? '',
    ai_skills: (c.ai_skills ?? []).join(', '),
    pipeline_stage: c.pipeline_stage ?? 'sourced',
    status: c.status ?? 'pending',
    job_post_id: c.job_posts?.id ?? c.job_post_id ?? '',
    reviewer_notes: c.reviewer_notes ?? '',
    nric: String(p.nric ?? (String(p.id_document_type ?? '').toLowerCase().includes('nric') ? p.id_document_reference : '') ?? ''),
    passport_number: String(p.passport_number ?? ''),
    nationality: String(p.nationality ?? ''),
    dob: String(p.dob ?? ''),
    gender: String(p.gender ?? ''),
    address: String(p.address ?? ''),
    current_company: String(p.current_company ?? p.current_employer ?? ''),
    current_title: String(p.current_title ?? p.current_role ?? ''),
    current_location: String(p.current_location ?? ''),
    preferred_location: String(p.preferred_location ?? ''),
    total_experience: String(p.total_experience ?? ''),
    relevant_experience: String(p.relevant_experience ?? ''),
    current_salary: String(p.current_salary ?? ''),
    expected_salary: String(p.expected_salary ?? p.salary_expectation ?? ''),
    notice_period: String(p.notice_period ?? ''),
    work_authorization: String(p.work_authorization ?? ''),
    visa_type: String(p.visa_type ?? ''),
    visa_expiry: String(p.visa_expiry ?? ''),
    hire_type: String(p.hire_type ?? ''),
    client_name: String(p.client_name ?? ''),
    applying_for: String(p.applying_for ?? ''),
    source_channel: String(p.source_channel ?? ''),
    interview_mode: String(p.interview_mode ?? ''),
    offers_in_hand: String(p.offers_in_hand ?? ''),
    lifecycle_status: String(p.lifecycle_status ?? ''),
    education: String(p.education ?? ''),
    certifications: String(p.certifications ?? ''),
    notes: String(p.notes ?? ''),
    follow_up_notes: String(p.follow_up_notes ?? ''),
    candidate_feedback: String(p.candidate_feedback ?? ''),
    internal_comments: String(p.internal_comments ?? ''),
    next_action: String(p.next_action ?? ''),
  }
}

const PIPELINE = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired']

export function EditCandidateModal({
  candidate,
  jobs,
  onClose,
  onSaved,
}: {
  candidate: EditableCandidate
  jobs: JobOption[]
  onClose: () => void
  onSaved: (updated: Partial<EditableCandidate> & { id: string; candidate_profile?: Record<string, string | null> }) => void
}) {
  const [form, setForm] = useState(() => fromCandidate(candidate))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [section, setSection] = useState<'identity' | 'employment' | 'commercial' | 'notes'>('identity')

  useEffect(() => {
    setForm(fromCandidate(candidate))
    setMsg(null)
  // Reset when switching to another candidate row
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  const set = (key: keyof FormState, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'nric') {
        const formatted = formatNric(value)
        next.nric = formatted
        if (isValidNric(formatted)) {
          const dob = nricToDob(formatted)
          const gender = nricToGender(formatted)
          if (dob && !prev.dob) next.dob = dob
          if (gender && !prev.gender) next.gender = gender
          if (!prev.nationality) next.nationality = 'Malaysian'
        }
      }
      return next
    })
  }

  const save = async () => {
    if (!form.candidate_name.trim()) {
      setMsg({ ok: false, text: 'Name is required.' })
      return
    }
    if (form.nric && form.nric.replace(/\D/g, '').length > 0 && form.nric.replace(/\D/g, '').length !== 12) {
      setMsg({ ok: false, text: 'NRIC must be 12 digits (e.g. 901231-10-5678).' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const candidate_profile = {
        nric: form.nric || null,
        passport_number: form.passport_number || null,
        nationality: form.nationality || null,
        dob: form.dob || null,
        gender: form.gender || null,
        address: form.address || null,
        current_company: form.current_company || null,
        current_employer: form.current_company || null,
        current_title: form.current_title || null,
        current_role: form.current_title || null,
        current_location: form.current_location || null,
        preferred_location: form.preferred_location || null,
        total_experience: form.total_experience || null,
        relevant_experience: form.relevant_experience || null,
        current_salary: form.current_salary || null,
        expected_salary: form.expected_salary || null,
        salary_expectation: form.expected_salary || null,
        notice_period: form.notice_period || null,
        work_authorization: form.work_authorization || null,
        visa_type: form.visa_type || null,
        visa_expiry: form.visa_expiry || null,
        hire_type: form.hire_type || null,
        client_name: form.client_name || null,
        applying_for: form.applying_for || null,
        source_channel: form.source_channel || null,
        interview_mode: form.interview_mode || null,
        offers_in_hand: form.offers_in_hand || null,
        lifecycle_status: form.lifecycle_status || null,
        education: form.education || null,
        certifications: form.certifications || null,
        notes: form.notes || null,
        follow_up_notes: form.follow_up_notes || null,
        candidate_feedback: form.candidate_feedback || null,
        internal_comments: form.internal_comments || null,
        next_action: form.next_action || null,
        id_document_type: form.nric ? 'NRIC' : null,
        id_document_reference: form.nric || null,
      }

      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: form.candidate_name.trim(),
          candidate_email: form.candidate_email.trim() || null,
          candidate_phone: form.candidate_phone.trim() || null,
          ai_skills: form.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
          pipeline_stage: form.pipeline_stage || undefined,
          status: form.status || undefined,
          job_post_id: form.job_post_id || null,
          reviewer_notes: form.reviewer_notes || null,
          candidate_profile,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? 'Save failed' })
        return
      }
      const updated = data.candidate ?? {}
      onSaved({
        id: candidate.id,
        candidate_name: updated.candidate_name ?? form.candidate_name,
        candidate_email: updated.candidate_email ?? form.candidate_email,
        candidate_phone: updated.candidate_phone ?? (form.candidate_phone || null),
        ai_skills: updated.ai_skills ?? form.ai_skills.split(',').map(s => s.trim()).filter(Boolean),
        pipeline_stage: updated.pipeline_stage ?? form.pipeline_stage,
        status: updated.status ?? form.status,
        reviewer_notes: updated.reviewer_notes ?? form.reviewer_notes,
        candidate_profile: updated.candidate_profile ?? candidate_profile,
        job_posts: form.job_post_id
          ? (jobs.find(j => j.id === form.job_post_id)
              ? { id: form.job_post_id, title: jobs.find(j => j.id === form.job_post_id)!.title, company: jobs.find(j => j.id === form.job_post_id)!.company ?? '' }
              : candidate.job_posts ?? null)
          : null,
      })
      setMsg({ ok: true, text: 'Candidate updated.' })
    } catch {
      setMsg({ ok: false, text: 'Network error — please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof FormState, label: string, opts?: { placeholder?: string; type?: 'text' | 'textarea' | 'date'; hint?: string }) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      {opts?.type === 'textarea' ? (
        <textarea
          value={form[key]}
          onChange={e => set(key, e.target.value)}
          rows={3}
          placeholder={opts.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y"
        />
      ) : (
        <input
          type={opts?.type === 'date' ? 'date' : 'text'}
          value={form[key]}
          onChange={e => set(key, e.target.value)}
          placeholder={opts?.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      )}
      {opts?.hint && <p className="text-[10px] text-slate-400 mt-0.5">{opts.hint}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Candidate</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{candidate.short_id ?? candidate.id.slice(0, 8)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200/80 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-slate-100 overflow-x-auto">
          {([
            ['identity', 'Identity'],
            ['employment', 'Employment'],
            ['commercial', 'Submission'],
            ['notes', 'Notes'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSection(k)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                section === k ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {section === 'identity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('candidate_name', 'Full name', { placeholder: 'Candidate full name' })}
              {field('candidate_email', 'Email', { placeholder: 'name@email.com' })}
              {field('candidate_phone', 'Phone', { placeholder: '+60 12-345 6789' })}
              {field('nric', 'NRIC (Malaysian)', { placeholder: '901231-10-5678', hint: 'Auto-fills DOB & gender when complete' })}
              {field('passport_number', 'Passport (Expat)', { placeholder: 'A12345678' })}
              {field('nationality', 'Nationality', { placeholder: 'Malaysian' })}
              {field('dob', 'Date of birth', { type: 'date' })}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Gender</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {field('address', 'Address', { type: 'textarea', placeholder: 'Street, postcode, city' })}
              {field('ai_skills', 'Skills (comma-separated)', { placeholder: 'React, Node.js, …' })}
            </div>
          )}

          {section === 'employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('current_company', 'Current employer')}
              {field('current_title', 'Current role / title')}
              {field('current_location', 'Current location')}
              {field('preferred_location', 'Preferred location')}
              {field('total_experience', 'Total experience', { placeholder: 'e.g. 5 years' })}
              {field('relevant_experience', 'Relevant experience', { placeholder: 'e.g. 3 years' })}
              {field('current_salary', 'Current salary (MYR)', { placeholder: 'e.g. 6500' })}
              {field('expected_salary', 'Expected salary (MYR)', { placeholder: 'e.g. 8000' })}
              {field('notice_period', 'Notice period', { placeholder: 'e.g. 1 month / Immediate' })}
              {field('work_authorization', 'Work authorization')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Visa type</label>
                <select value={form.visa_type} onChange={e => set('visa_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">Select</option>
                  {VISA_TYPES.map(v => <option key={v} value={v}>{VISA_TYPE_LABELS[v as VisaType]}</option>)}
                </select>
              </div>
              {field('visa_expiry', 'Visa validity', { placeholder: 'e.g. Dec 2027 / Indefinite' })}
              {field('education', 'Education', { type: 'textarea' })}
              {field('certifications', 'Certifications', { type: 'textarea' })}
            </div>
          )}

          {section === 'commercial' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Lifecycle status</label>
                <select value={form.lifecycle_status} onChange={e => set('lifecycle_status', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">Select</option>
                  {LIFECYCLE_STATUSES.map(s => (
                    <option key={s} value={s}>{LIFECYCLE_LABELS[s as LifecycleStatus]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Pipeline stage</label>
                <select value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  {PIPELINE.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Record status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm capitalize">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Hire type</label>
                <select value={form.hire_type} onChange={e => set('hire_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">Select</option>
                  {HIRE_TYPES.map(h => <option key={h} value={h}>{HIRE_TYPE_LABELS[h as HireType]}</option>)}
                </select>
              </div>
              {field('client_name', 'Client')}
              {field('applying_for', 'Applying for')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Screened / linked job</label>
                <select value={form.job_post_id} onChange={e => set('job_post_id', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">No job linked</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.company ? ` — ${j.company}` : ''}</option>)}
                </select>
              </div>
              {field('source_channel', 'Source channel')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Interview mode</label>
                <select value={form.interview_mode} onChange={e => set('interview_mode', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
                  <option value="">Select</option>
                  {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {field('offers_in_hand', 'Offers in hand')}
            </div>
          )}

          {section === 'notes' && (
            <div className="grid grid-cols-1 gap-3">
              {field('notes', 'Recruiter notes', { type: 'textarea' })}
              {field('follow_up_notes', 'Follow-up notes', { type: 'textarea' })}
              {field('candidate_feedback', 'Candidate feedback', { type: 'textarea' })}
              {field('internal_comments', 'Internal comments', { type: 'textarea' })}
              {field('next_action', 'Next action')}
              {field('reviewer_notes', 'Reviewer notes (system)', { type: 'textarea' })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/80">
          <div className="min-w-0">
            {msg && (
              <p className={`text-xs font-medium flex items-center gap-1 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {!msg.ok && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {msg.text}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
