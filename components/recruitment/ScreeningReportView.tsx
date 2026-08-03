'use client'

import { AlertCircle, Brain, CheckCircle, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ScreenResult } from '@/lib/screeningTypes'
import { normalizeDecisionBands } from '@/lib/screeningTypes'

type Props = {
  data: ScreenResult
  /** Compact = Candidate 360 / modal; card = AI Screen results (full coloured sections) */
  variant?: 'card' | 'compact'
  showHeader?: boolean
  screenedAtLabel?: string
}

function stars(tier?: string): string {
  if (tier === 'mandatory') return '★★★★★'
  if (tier === 'strong') return '★★★★'
  if (tier === 'preferred') return '★★★'
  return '★★★★★'
}

function scoreGrade(score: number) {
  if (score >= 85) return { label: 'Excellent', color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' }
  if (score >= 70) return { label: 'Shortlist', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200' }
  if (score >= 60) return { label: 'Hold', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200' }
  return { label: 'Reject', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200' }
}

function decisionStyle(decision: string) {
  const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Excellent: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-600' },
    Shortlisted: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-600' },
    Hold: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', dot: 'bg-amber-600' },
    'On Hold': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', dot: 'bg-amber-600' },
    Rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-600' },
  }
  return map[decision] ?? map.Rejected
}

function riskTone(level?: string) {
  const l = (level || '').toLowerCase()
  if (l.includes('very')) return 'bg-red-100 text-red-800 border-red-300'
  if (l.includes('high')) return 'bg-red-50 text-red-700 border-red-200'
  if (l.includes('medium')) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-emerald-50 text-emerald-800 border-emerald-200'
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${className}`}>
      {children}
    </span>
  )
}

export function ScreeningReportView({
  data: r,
  variant = 'card',
  showHeader = true,
  screenedAtLabel,
}: Props) {
  const ev = r.evaluation
  const matchedSkills = r.jd_match?.matching_skills
    ?? [...(ev?.high_match_skills ?? []), ...(ev?.medium_match_skills ?? [])]
  const missingSkills = r.jd_match?.missing_skills
    ?? ev?.low_or_missing_match_skills
    ?? ev?.missing_skills
    ?? []
  const optionalMatched = r.jd_match?.optional_skills_match ?? []
  const strongSkills = r.strong_skills?.length
    ? r.strong_skills
    : matchedSkills
  const strengths = ev?.candidate_strengths ?? ev?.strengths ?? []
  const weaknesses = ev?.candidate_weaknesses ?? ev?.weaknesses ?? []
  const redFlags = (r.red_flags && r.red_flags.length > 0) ? r.red_flags : weaknesses.slice(0, 3)
  const improvements = r.required_improvements?.length
    ? r.required_improvements
    : (r.required_actions ?? [])

  const score = Math.round(Number(r.score) || 0)
  const bands = normalizeDecisionBands(score)
  const decision = r.decision || bands.decision
  const classification = r.classification || bands.classification
  const recommendation = r.recommendation || bands.recommendation
  const grade = scoreGrade(score)
  const dc = decisionStyle(String(decision))
  const jdMatch = r.jd_match?.match_percent ?? ev?.overall_fit_rating
  const riskLevel = ev?.risk_level
  const reasoning = r.hiring_reasoning || ev?.justification || ''
  const expAudit = r.experience_audit
  const gaps = r.gap_analysis?.gaps ?? []
  const totalMissingMonths = r.gap_analysis?.total_missing_months ?? 0
  const edu = r.education_check
  const audit = r.resume_audit
  const mandatory = r.mandatory_requirements ?? []
  const mandatoryMatched = mandatory.filter(m => m.status === 'matched')
  const mandatoryMissing = mandatory.filter(m => m.status === 'missing' || m.status === 'partial')
  const criticalMissing = mandatoryMissing.length
    ? mandatoryMissing
    : missingSkills.map(name => ({ name, status: 'missing' as const, tier: 'mandatory' as const }))

  const pad = variant === 'compact' ? 'p-3' : 'p-4'
  const sectionTitle = 'text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5'

  return (
    <div className={variant === 'compact' ? 'space-y-4 text-slate-800' : 'space-y-0'}>
      {showHeader && (
        <div className={`flex items-start gap-4 ${variant === 'card' ? 'px-5 pb-4' : ''}`}>
          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl border-2 ${grade.bg} ${grade.border} shadow-sm`}>
            <span className="text-2xl font-black leading-none" style={{ color: grade.color }}>{score}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">AI Score</span>
            <span className="text-[9px] font-semibold mt-0.5" style={{ color: grade.color }}>{grade.label}</span>
          </div>
          <div className="flex-1 min-w-0">
            {r.name && (
              <h3 className="text-base font-bold text-gray-900 mb-1 truncate">{r.name}</h3>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge className={`${dc.bg} ${dc.text} ${dc.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
                {decision}
              </Badge>
              {classification && (
                <Badge className={
                  String(classification).includes('EXCELLENT') || classification === 'STRONG'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : classification === 'KAV' || classification === 'HOLD'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                }>
                  {classification === 'KAV' ? 'Keep An Eye' : classification}
                </Badge>
              )}
              {recommendation && (
                <Badge className={
                  recommendation === 'Hire' ? 'bg-green-50 text-green-800 border-green-200'
                    : recommendation === 'Hold' ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                }>
                  Rec: {recommendation}
                </Badge>
              )}
              {jdMatch != null && (
                <Badge className="bg-blue-50 text-blue-800 border-blue-200">JD Match: {jdMatch}%</Badge>
              )}
              {r.resume_score != null && (
                <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Resume: {Math.round(Number(r.resume_score))}%</Badge>
              )}
              {riskLevel && (
                <Badge className={riskTone(riskLevel)}>Risk: {riskLevel}</Badge>
              )}
              {r.interview_probability != null && (
                <Badge className="bg-violet-50 text-violet-800 border-violet-200">Interview {Math.round(Number(r.interview_probability))}%</Badge>
              )}
              {r.offer_probability != null && (
                <Badge className="bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200">Offer {Math.round(Number(r.offer_probability))}%</Badge>
              )}
            </div>
            {screenedAtLabel && (
              <p className="text-[10px] text-gray-400 font-mono mt-2">Screened: {screenedAtLabel}</p>
            )}
          </div>
        </div>
      )}

      {r.executive_summary && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-indigo-50/40' : 'bg-indigo-50/50 rounded-xl border border-indigo-100'}`}>
          <p className={`${sectionTitle} text-indigo-700`}>
            <Brain className="w-3.5 h-3.5" /> Executive Summary
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{r.executive_summary}</p>
        </div>
      )}

      {mandatory.length > 0 && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100' : 'rounded-xl border border-slate-200 bg-white'}`}>
          <p className={`${sectionTitle} text-slate-700`}>Mandatory Requirements ★★★★★</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mandatory.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  m.status === 'matched'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : m.status === 'partial'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-[10px] opacity-70">{stars(m.tier)} · {m.status}</span>
                </div>
                {m.evidence && <p className="mt-1 text-[11px] opacity-80 line-clamp-2">{m.evidence}</p>}
                {m.confidence != null && (
                  <p className="mt-0.5 text-[10px] font-medium">Confidence: {Math.round(Number(m.confidence))}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(strongSkills.length > 0 || criticalMissing.length > 0 || redFlags.length > 0) && (
        <div className={`grid grid-cols-1 sm:grid-cols-3 ${variant === 'card' ? 'border-t border-gray-100' : 'gap-3'}`}>
          <div className={`${pad} ${variant === 'card' ? 'border-r border-gray-100 bg-emerald-50/40' : 'rounded-xl border border-emerald-200 bg-emerald-50/80'}`}>
            <p className={`${sectionTitle} text-emerald-800`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Strong / Matched
            </p>
            {strongSkills.length === 0
              ? <p className="text-xs text-gray-400 italic">None detected</p>
              : (
                <div className="flex flex-wrap gap-1.5">
                  {strongSkills.map(s => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium">{s}</span>
                  ))}
                </div>
              )}
            {mandatoryMatched.length > 0 && mandatory.length > 0 && (
              <p className="text-[10px] text-emerald-700 mt-2 font-medium">{mandatoryMatched.length}/{mandatory.length} mandatory matched</p>
            )}
          </div>
          <div className={`${pad} ${variant === 'card' ? 'border-r border-gray-100 bg-red-50/30' : 'rounded-xl border border-red-200 bg-red-50/80'}`}>
            <p className={`${sectionTitle} text-red-800`}>
              <span className="w-2 h-2 rounded-full bg-red-500" /> Critical Missing
            </p>
            {criticalMissing.length === 0
              ? <p className="text-xs text-gray-400 italic">None detected</p>
              : (
                <div className="flex flex-wrap gap-1.5">
                  {criticalMissing.map((m, i) => (
                    <span key={`${m.name}-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 font-medium">
                      {m.name}{m.status === 'partial' ? ' (partial)' : ''}
                    </span>
                  ))}
                </div>
              )}
          </div>
          <div className={`${pad} ${variant === 'card' ? 'bg-amber-50/30' : 'rounded-xl border border-amber-200 bg-amber-50/80'}`}>
            <p className={`${sectionTitle} text-amber-900`}>
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Red Flags
            </p>
            {redFlags.length === 0
              ? <p className="text-xs text-gray-400 italic">None detected</p>
              : (
                <ul className="space-y-1.5">
                  {redFlags.map((f, i) => (
                    <li key={i} className="text-xs text-amber-900 flex gap-1.5">
                      <span className="text-amber-500 flex-shrink-0">⚠</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}

      {optionalMatched.length > 0 && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-cyan-50/40' : 'rounded-xl border border-cyan-200 bg-cyan-50'}`}>
          <p className={`${sectionTitle} text-cyan-900`}>Preferred / Nice-to-have ★★★</p>
          <div className="flex flex-wrap gap-1.5">
            {(r.preferred_skills?.length ? r.preferred_skills : optionalMatched).map(s => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-200 font-medium">{s}</span>
            ))}
          </div>
        </div>
      )}

      {(expAudit || edu || totalMissingMonths > 0) && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${variant === 'card' ? 'border-t border-gray-100 bg-orange-50/20' : 'gap-3'}`}>
          {expAudit && (
            <div className={`${pad} ${variant === 'card' ? 'border-r border-gray-100' : 'rounded-xl border border-orange-200 bg-orange-50'}`}>
              <p className={`${sectionTitle} text-orange-800`}>
                <AlertCircle className="w-3.5 h-3.5" /> Experience Validation
              </p>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex justify-between"><span className="text-gray-500">Claimed</span><span className="font-semibold">{expAudit.claimed_years ?? '—'} yrs</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Calculated</span><span className="font-semibold">{expAudit.calculated_years ?? '—'} yrs</span></div>
                {expAudit.difference_years != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Diff</span>
                    <span className={`font-bold ${Math.abs(expAudit.difference_years) > 1 ? 'text-red-600' : 'text-amber-700'}`}>
                      {expAudit.difference_years} yrs
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Verdict</span>
                  <span className={`font-bold ${String(expAudit.verdict).toLowerCase().includes('match') ? 'text-emerald-700' : 'text-red-600'}`}>
                    {expAudit.verdict ?? '—'}
                  </span>
                </div>
                {expAudit.current_employer && (
                  <div className="flex justify-between"><span className="text-gray-500">Current</span><span className="font-semibold text-right">{expAudit.current_role ? `${expAudit.current_role} @ ` : ''}{expAudit.current_employer}</span></div>
                )}
              </div>
              {totalMissingMonths > 0 && (
                <div className="mt-3 pt-2 border-t border-orange-200/60">
                  <p className="text-[11px] font-bold text-orange-800 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Gaps: {totalMissingMonths} mo
                  </p>
                  <ul className="space-y-1">
                    {gaps.slice(0, 4).map((g, i) => (
                      <li key={i} className="text-[11px] text-gray-600">{g.from} → {g.to}{g.months ? ` (${g.months}mo)` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {(edu || audit) && (
            <div className={`${pad} ${variant === 'card' ? '' : 'rounded-xl border border-slate-200 bg-slate-50'}`}>
              <p className={`${sectionTitle} text-slate-700`}>
                <CheckCircle className="w-3.5 h-3.5" /> Education & Resume Audit
              </p>
              {edu && (
                <div className="space-y-1 text-xs text-gray-700 mb-3">
                  <div className="flex justify-between"><span className="text-gray-500">Degree present</span><span className="font-semibold">{edu.degree_present ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Passout year</span><span className="font-semibold">{edu.passout_year_present ? 'Yes' : 'No'}</span></div>
                  {edu.flag && <p className="text-amber-800 mt-1">{edu.flag}</p>}
                </div>
              )}
              {audit && (
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    ['Chronology', audit.experience_order_ok],
                    ['Dates', audit.date_format_ok],
                    ['Grammar', audit.grammar_ok],
                    ['Formatting', audit.formatting_ok],
                    ['Education', audit.education_complete],
                    ['Metrics', audit.quantified_achievements],
                  ].map(([label, ok]) => (
                    <div key={String(label)} className={`rounded-md px-2 py-1 border ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                      {label}: {ok == null ? '—' : ok ? 'Yes' : 'No'}
                    </div>
                  ))}
                  {audit.overall_quality_score != null && (
                    <div className="col-span-2 text-xs font-semibold text-slate-700 mt-1">
                      Resume quality: {Math.round(Number(audit.overall_quality_score))}/100
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(r.skill_evidence?.length ?? 0) > 0 && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-slate-50/50' : 'rounded-xl border border-slate-200'}`}>
          <p className={`${sectionTitle} text-slate-700`}>Skill Evidence</p>
          <ul className="space-y-2">
            {r.skill_evidence!.slice(0, 8).map((e, i) => (
              <li key={i} className="text-xs text-gray-700 border border-slate-200 rounded-lg px-3 py-2 bg-white">
                <span className="font-bold text-slate-900">{e.skill}</span>
                {(e.role || e.company) && (
                  <span className="text-slate-500"> — {[e.role, e.company].filter(Boolean).join(' @ ')}</span>
                )}
                {e.dates && <span className="text-slate-400"> ({e.dates})</span>}
                {e.quote && <p className="mt-1 italic text-slate-600">&ldquo;{e.quote}&rdquo;</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${variant === 'card' ? 'border-t border-gray-100' : 'gap-3'}`}>
          {strengths.length > 0 && (
            <div className={`${pad} ${variant === 'card' ? 'border-r border-gray-100 bg-emerald-50/30' : 'rounded-xl border border-emerald-200 bg-emerald-50'}`}>
              <p className={`${sectionTitle} text-emerald-800`}><CheckCircle className="w-3.5 h-3.5" /> Strengths</p>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-emerald-600">✓</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div className={`${pad} ${variant === 'card' ? 'bg-red-50/20' : 'rounded-xl border border-red-200 bg-red-50'}`}>
              <p className={`${sectionTitle} text-red-800`}><AlertCircle className="w-3.5 h-3.5" /> Gaps & Weaknesses</p>
              <ul className="space-y-1.5">
                {weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-red-500">×</span><span>{w}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {reasoning && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-gray-50' : 'rounded-xl border border-slate-200 bg-slate-50'}`}>
          <p className={`${sectionTitle} text-gray-700`}>
            <Brain className="w-3.5 h-3.5 text-indigo-500" /> AI Reasoning
          </p>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{reasoning}</p>
        </div>
      )}

      {r.recruiter_recommendation && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-violet-50/40' : 'rounded-xl border border-violet-200 bg-violet-50'}`}>
          <p className={`${sectionTitle} text-violet-800`}>Recruiter Recommendation</p>
          <div className="space-y-1.5 text-xs text-violet-950">
            {r.recruiter_recommendation.interview_recommendation && (
              <p><span className="font-semibold">Interview:</span> {r.recruiter_recommendation.interview_recommendation}</p>
            )}
            {r.recruiter_recommendation.hiring_recommendation && (
              <p><span className="font-semibold">Hiring:</span> {r.recruiter_recommendation.hiring_recommendation}</p>
            )}
            {r.recruiter_recommendation.training_recommendation && (
              <p><span className="font-semibold">Training:</span> {r.recruiter_recommendation.training_recommendation}</p>
            )}
            {(r.recruiter_recommendation.suitable_roles?.length ?? 0) > 0 && (
              <p><span className="font-semibold">Suitable roles:</span> {r.recruiter_recommendation.suitable_roles!.join(', ')}</p>
            )}
          </div>
        </div>
      )}

      {improvements.length > 0 && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-blue-50/40' : 'rounded-xl border border-blue-200 bg-blue-50'}`}>
          <p className={`${sectionTitle} text-blue-800`}>
            <CheckCircle className="w-3.5 h-3.5" /> Required Improvements
          </p>
          <ul className="space-y-1.5">
            {improvements.map((a, i) => (
              <li key={i} className="text-xs text-blue-900 flex gap-1.5">
                <span className="font-bold text-blue-500">{i + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ev?.risk_explanation && (
        <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-gray-50' : ''}`}>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900"><span className="font-semibold">Risk Note: </span>{ev.risk_explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
