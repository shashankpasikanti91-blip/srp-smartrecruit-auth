'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, Save } from 'lucide-react'
import { formatNric, isValidNric, nricToDob, nricToGender } from '@/lib/nric'
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
import type { EditableCandidate } from './EditCandidateModal'

type JobOption = { id: string; title: string; company?: string | null }

type Form = {
  applying_for: string
  client_name: string
  hire_type: string
  lifecycle_status: string
  first_name: string
  last_name: string
  phone: string
  email: string
  nationality: string
  nric: string
  visa_type: string
  visa_expiry: string
  current_company: string
  current_location: string
  preferred_location: string
  current_title: string
  submission_date: string
  source_channel: string
  address: string
  total_experience: string
  relevant_experience: string
  current_salary: string
  expected_salary: string
  notice_period: string
  interview_mode: string
  offers_in_hand: string
  notes: string
  follow_up_notes: string
  candidate_feedback: string
  internal_comments: string
  next_action: string
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function fromCandidate(c: EditableCandidate): Form {
  const p = c.candidate_profile ?? {}
  const { first, last } = splitName(c.candidate_name ?? '')
  return {
    applying_for: String(p.applying_for ?? c.job_posts?.title ?? ''),
    client_name: String(p.client_name ?? c.job_posts?.company ?? ''),
    hire_type: String(p.hire_type ?? ''),
    lifecycle_status: String(p.lifecycle_status ?? ''),
    first_name: first,
    last_name: last,
    phone: c.candidate_phone ?? '',
    email: c.candidate_email ?? '',
    nationality: String(p.nationality ?? ''),
    nric: String(p.nric ?? ''),
    visa_type: String(p.visa_type ?? ''),
    visa_expiry: String(p.visa_expiry ?? ''),
    current_company: String(p.current_company ?? p.current_employer ?? ''),
    current_location: String(p.current_location ?? ''),
    preferred_location: String(p.preferred_location ?? ''),
    current_title: String(p.current_title ?? p.current_role ?? ''),
    submission_date: String(p.submission_date ?? new Date().toISOString().slice(0, 10)),
    source_channel: String(p.source_channel ?? ''),
    address: String(p.address ?? ''),
    total_experience: String(p.total_experience ?? ''),
    relevant_experience: String(p.relevant_experience ?? ''),
    current_salary: String(p.current_salary ?? ''),
    expected_salary: String(p.expected_salary ?? p.salary_expectation ?? ''),
    notice_period: String(p.notice_period ?? ''),
    interview_mode: String(p.interview_mode ?? ''),
    offers_in_hand: String(p.offers_in_hand ?? ''),
    notes: String(p.notes ?? ''),
    follow_up_notes: String(p.follow_up_notes ?? ''),
    candidate_feedback: String(p.candidate_feedback ?? ''),
    internal_comments: String(p.internal_comments ?? ''),
    next_action: String(p.next_action ?? ''),
  }
}

export function SubmissionDetailsModal({
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
  const [tab, setTab] = useState<'contact' | 'salary' | 'notes'>('contact')
  const [form, setForm] = useState(() => fromCandidate(candidate))
  const [jobId, setJobId] = useState(candidate.job_posts?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [submissionShortId, setSubmissionShortId] = useState<string | null>(null)

  useEffect(() => {
    setForm(fromCandidate(candidate))
    setJobId(candidate.job_posts?.id ?? '')
    setMsg(null)
    setErr(null)
    fetch(`/api/submissions/latest?resume_id=${candidate.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.submission) {
          setSubmissionId(d.submission.id)
          setSubmissionShortId(d.submission.short_id)
        } else {
          setSubmissionId(null)
          setSubmissionShortId(null)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  const set = (key: keyof Form, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'nric') {
        next.nric = formatNric(value)
        if (isValidNric(next.nric)) {
          if (!prev.nationality) next.nationality = 'Malaysian'
        }
      }
      return next
    })
  }

  const save = async () => {
    if (form.nric && form.nric.replace(/\D/g, '').length && form.nric.replace(/\D/g, '').length !== 12) {
      setErr('NRIC must be 12 digits (e.g. 901231-10-5678).')
      return
    }
    setSaving(true)
    setErr(null)
    setMsg(null)
    const fullName = [form.first_name, form.last_name].map(s => s.trim()).filter(Boolean).join(' ')
    const dob = isValidNric(form.nric) ? nricToDob(form.nric) : null
    const gender = isValidNric(form.nric) ? nricToGender(form.nric) : null
    const candidate_profile = {
      applying_for: form.applying_for || null,
      client_name: form.client_name || null,
      hire_type: form.hire_type || null,
      lifecycle_status: form.lifecycle_status || null,
      nationality: form.nationality || null,
      nric: form.nric || null,
      id_document_type: form.nric ? 'NRIC' : null,
      id_document_reference: form.nric || null,
      visa_type: form.visa_type || null,
      visa_expiry: form.visa_expiry || null,
      current_company: form.current_company || null,
      current_employer: form.current_company || null,
      current_location: form.current_location || null,
      preferred_location: form.preferred_location || null,
      current_title: form.current_title || null,
      current_role: form.current_title || null,
      submission_date: form.submission_date || null,
      source_channel: form.source_channel || null,
      address: form.address || null,
      total_experience: form.total_experience || null,
      relevant_experience: form.relevant_experience || null,
      current_salary: form.current_salary || null,
      expected_salary: form.expected_salary || null,
      salary_expectation: form.expected_salary || null,
      notice_period: form.notice_period || null,
      interview_mode: form.interview_mode || null,
      offers_in_hand: form.offers_in_hand || null,
      notes: form.notes || null,
      follow_up_notes: form.follow_up_notes || null,
      candidate_feedback: form.candidate_feedback || null,
      internal_comments: form.internal_comments || null,
      next_action: form.next_action || null,
      ...(dob ? { dob } : {}),
      ...(gender ? { gender } : {}),
    }

    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: fullName || candidate.candidate_name,
          candidate_email: form.email.trim() || null,
          candidate_phone: form.phone.trim() || null,
          job_post_id: jobId || null,
          candidate_profile,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(data.error ?? 'Save failed')
        return
      }
      const job = jobs.find(j => j.id === jobId)
      onSaved({
        id: candidate.id,
        candidate_name: data.candidate?.candidate_name ?? fullName,
        candidate_email: data.candidate?.candidate_email ?? form.email,
        candidate_phone: data.candidate?.candidate_phone ?? form.phone,
        candidate_profile: data.candidate?.candidate_profile ?? candidate_profile,
        job_posts: job ? { id: job.id, title: job.title, company: job.company ?? '' } : (jobId ? candidate.job_posts ?? null : null),
      })

      // Upsert normalized submission row
      const stage = form.lifecycle_status === 'submitted' ? 'submitted'
        : form.lifecycle_status === 'selected' ? 'shortlisted'
        : 'draft'
      const subPayload = {
        resume_id: candidate.id,
        job_post_id: jobId || null,
        client_name: form.client_name,
        applying_for: form.applying_for,
        hire_type: form.hire_type,
        stage,
        lifecycle_status: form.lifecycle_status,
        submission_date: form.submission_date,
        notes: form.notes,
        feedback: {
          follow_up_notes: form.follow_up_notes,
          candidate_feedback: form.candidate_feedback,
          internal_comments: form.internal_comments,
          next_action: form.next_action,
        },
      }
      const subRes = await fetch(
        submissionId ? `/api/submissions/${submissionId}` : '/api/submissions',
        {
          method: submissionId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subPayload),
        }
      )
      const subData = await subRes.json().catch(() => ({}))
      if (!subRes.ok) {
        setErr(subData.error ?? 'Submission save failed')
        return
      }
      if (subData.submission) {
        setSubmissionId(subData.submission.id)
        setSubmissionShortId(subData.submission.short_id)
      }

      setMsg(submissionShortId || subData.submission?.short_id
        ? `Saved · ${subData.submission?.short_id ?? submissionShortId}`
        : 'Submission details saved.')
    } catch {
      setErr('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof Form, label: string, ph?: string) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
    </div>
  )
  const area = (key: keyof Form, label: string) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <textarea value={form[key]} onChange={e => set(key, e.target.value)} rows={3}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Submission Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">{candidate.candidate_name} · {candidate.short_id}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-slate-100">
          {([
            ['contact', 'Contact & Profile'],
            ['salary', 'Salary & Logistics'],
            ['notes', 'Recruiter Notes'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 ${tab === k ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {input('applying_for', 'Requirement / applying for')}
              {input('client_name', 'Client')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Linked job</label>
                <select value={jobId} onChange={e => setJobId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">None</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.company ? ` — ${j.company}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Hire type</label>
                <select value={form.hire_type} onChange={e => set('hire_type', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Select</option>
                  {HIRE_TYPES.map(h => <option key={h} value={h}>{HIRE_TYPE_LABELS[h as HireType]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Candidate status</label>
                <select value={form.lifecycle_status} onChange={e => set('lifecycle_status', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Select</option>
                  {LIFECYCLE_STATUSES.map(s => <option key={s} value={s}>{LIFECYCLE_LABELS[s as LifecycleStatus]}</option>)}
                </select>
              </div>
              {input('first_name', 'First name')}
              {input('last_name', 'Last name')}
              {input('phone', 'Phone', '+60 …')}
              {input('email', 'Email')}
              {input('nationality', 'Nationality', 'Malaysian')}
              {input('nric', 'NRIC', '901231-10-5678')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Visa type</label>
                <select value={form.visa_type} onChange={e => set('visa_type', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Select</option>
                  {VISA_TYPES.map(v => <option key={v} value={v}>{VISA_TYPE_LABELS[v as VisaType]}</option>)}
                </select>
              </div>
              {input('visa_expiry', 'Visa validity')}
              {input('current_company', 'Current employer')}
              {input('current_location', 'Current location')}
              {input('preferred_location', 'Preferred location')}
              {input('current_title', 'Current role')}
              {input('submission_date', 'Submission date')}
              {input('source_channel', 'Source channel')}
              {area('address', 'Address')}
            </div>
          )}
          {tab === 'salary' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {input('total_experience', 'Total experience')}
              {input('relevant_experience', 'Relevant experience')}
              {input('current_salary', 'Current salary (MYR)')}
              {input('expected_salary', 'Expected salary (MYR)')}
              {input('notice_period', 'Notice period')}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Interview mode</label>
                <select value={form.interview_mode} onChange={e => set('interview_mode', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Select</option>
                  {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {input('offers_in_hand', 'Offers in hand')}
            </div>
          )}
          {tab === 'notes' && (
            <div className="grid grid-cols-1 gap-3">
              {area('notes', 'Recruiter notes')}
              {area('follow_up_notes', 'Follow-up notes')}
              {area('candidate_feedback', 'Candidate feedback')}
              {area('internal_comments', 'Internal comments')}
              {input('next_action', 'Next action')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/70">
          <div className="text-xs">
            {err && <span className="text-red-600 font-medium">{err}</span>}
            {msg && <span className="text-emerald-700 font-medium">{msg}</span>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
