'use client'

import { Component, type ErrorInfo, type ReactNode, useMemo, useState } from 'react'
import { AlertCircle, Brain, CheckCircle, ChevronDown, Clock } from 'lucide-react'
import type { ScreenResult, MandatoryRequirement } from '@/lib/screeningTypes'
import { normalizeDecisionBands } from '@/lib/screeningTypes'

type Props = {
  data: ScreenResult
  variant?: 'card' | 'compact'
  showHeader?: boolean
  screenedAtLabel?: string
  /** When true, show a short briefing first; full sections stay expandable */
  briefFirst?: boolean
}

/** Coerce unknown AI payloads into safe display strings. */
function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const pick = o.name ?? o.skill ?? o.title ?? o.label ?? o.text ?? o.summary ?? o.message
    if (pick != null && (typeof pick === 'string' || typeof pick === 'number')) return String(pick)
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }
  return fallback
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(v => asText(v).trim())
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
}

function asMandatoryList(value: unknown): MandatoryRequirement[] {
  if (!Array.isArray(value)) return []
  return value.map((raw, i) => {
    if (typeof raw === 'string') {
      return { name: raw, status: 'missing' as const, tier: 'mandatory' as const }
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>
      const statusRaw = asText(o.status, 'missing').toLowerCase()
      const status = statusRaw === 'matched' || statusRaw === 'partial' || statusRaw === 'missing'
        ? (statusRaw as MandatoryRequirement['status'])
        : 'missing'
      const tierRaw = asText(o.tier, 'mandatory').toLowerCase()
      const tier = tierRaw === 'strong' || tierRaw === 'preferred' || tierRaw === 'mandatory'
        ? (tierRaw as MandatoryRequirement['tier'])
        : 'mandatory'
      return {
        name: asText(o.name ?? o.requirement ?? o.skill, `Requirement ${i + 1}`),
        status,
        tier,
        confidence: typeof o.confidence === 'number' ? o.confidence : Number(o.confidence) || undefined,
        evidence: asText(o.evidence || o.note || '') || undefined,
      }
    }
    return { name: `Requirement ${i + 1}`, status: 'missing' as const, tier: 'mandatory' as const }
  })
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

function PillList({ items, tone }: { items: string[]; tone: 'green' | 'red' | 'amber' | 'cyan' }) {
  const cls =
    tone === 'green' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : tone === 'red' ? 'bg-red-100 text-red-800 border-red-200'
        : tone === 'cyan' ? 'bg-cyan-100 text-cyan-900 border-cyan-200'
          : 'bg-amber-100 text-amber-900 border-amber-200'
  if (!items.length) return <p className="text-xs text-gray-400 italic">None detected</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span key={`${s}-${i}`} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>{s}</span>
      ))}
    </div>
  )
}

/** Prevent one bad AI payload from blanking the whole dashboard. */
export class ScreeningReportErrorBoundary extends Component<
  { children: ReactNode; fallbackTitle?: string },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error?.message || 'Could not render screening details' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ScreeningReportView]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-bold">{this.props.fallbackTitle || 'Details could not be shown'}</p>
          <p className="text-xs mt-1 opacity-80">{this.state.error}</p>
          <p className="text-xs mt-2">Scores and Save/Discard still work — try Collapse, then expand again, or re-run screening.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export function ScreeningReportView({
  data: raw,
  variant = 'card',
  showHeader = true,
  screenedAtLabel,
  briefFirst = true,
}: Props) {
  const [showFull, setShowFull] = useState(!briefFirst || variant === 'compact')

  const model = useMemo(() => {
    const r = raw && typeof raw === 'object' ? raw : {} as ScreenResult
    const ev = r.evaluation && typeof r.evaluation === 'object' ? r.evaluation : undefined
    const matchedSkills = asStringList(
      r.jd_match?.matching_skills ?? [...asStringList(ev?.high_match_skills), ...asStringList(ev?.medium_match_skills)],
    )
    const missingSkills = asStringList(
      r.jd_match?.missing_skills ?? ev?.low_or_missing_match_skills ?? ev?.missing_skills,
    )
    const optionalMatched = asStringList(r.jd_match?.optional_skills_match)
    const strongSkills = asStringList(r.strong_skills).length
      ? asStringList(r.strong_skills)
      : matchedSkills
    const preferredSkills = asStringList(r.preferred_skills).length
      ? asStringList(r.preferred_skills)
      : optionalMatched
    const strengths = asStringList(ev?.candidate_strengths ?? ev?.strengths)
    const weaknesses = asStringList(ev?.candidate_weaknesses ?? ev?.weaknesses)
    const redFlags = asStringList(r.red_flags).length ? asStringList(r.red_flags) : weaknesses.slice(0, 3)
    const improvements = asStringList(r.required_improvements).length
      ? asStringList(r.required_improvements)
      : asStringList(r.required_actions)

    const score = Math.round(Number(r.score) || 0)
    const bands = normalizeDecisionBands(score)
    const decision = asText(r.decision, bands.decision)
    const classification = asText(r.classification, bands.classification)
    const recommendation = asText(r.recommendation, bands.recommendation)
    const grade = scoreGrade(score)
    const dc = decisionStyle(decision)
    const jdMatchRaw = r.jd_match?.match_percent ?? ev?.overall_fit_rating
    const jdMatch = jdMatchRaw == null || Number.isNaN(Number(jdMatchRaw)) ? null : Math.round(Number(jdMatchRaw))
    const riskLevel = asText(ev?.risk_level) || undefined
    const reasoning = asText(r.hiring_reasoning || ev?.justification)
    const summary = asText(r.executive_summary)
    const expAudit = r.experience_audit && typeof r.experience_audit === 'object' ? r.experience_audit : undefined
    const gaps = Array.isArray(r.gap_analysis?.gaps) ? r.gap_analysis!.gaps! : []
    const totalMissingMonths = Number(r.gap_analysis?.total_missing_months) || 0
    const edu = r.education_check && typeof r.education_check === 'object' ? r.education_check : undefined
    const audit = r.resume_audit && typeof r.resume_audit === 'object' ? r.resume_audit : undefined
    const mandatory = asMandatoryList(r.mandatory_requirements)
    const mandatoryMatched = mandatory.filter(m => m.status === 'matched')
    const mandatoryMissing = mandatory.filter(m => m.status === 'missing' || m.status === 'partial')
    const criticalMissing = mandatoryMissing.length
      ? mandatoryMissing
      : missingSkills.map(name => ({ name, status: 'missing' as const, tier: 'mandatory' as const }))

    const briefWhy = summary
      || (reasoning ? reasoning.slice(0, 280) + (reasoning.length > 280 ? '…' : '') : '')
      || (matchedSkills.length
        ? `Strong on ${matchedSkills.slice(0, 3).join(', ')}${missingSkills.length ? `; gaps in ${missingSkills.slice(0, 2).join(', ')}` : ''}.`
        : 'AI completed screening. Open full details for the complete audit.')

    return {
      r, ev, matchedSkills, missingSkills, strongSkills, preferredSkills, strengths, weaknesses,
      redFlags, improvements, score, decision, classification, recommendation, grade, dc, jdMatch,
      riskLevel, reasoning, summary, expAudit, gaps, totalMissingMonths, edu, audit, mandatory,
      mandatoryMatched, criticalMissing, briefWhy,
    }
  }, [raw])

  const {
    r, ev, matchedSkills, missingSkills, strongSkills, preferredSkills, strengths, weaknesses,
    redFlags, improvements, score, decision, classification, recommendation, grade, dc, jdMatch,
    riskLevel, reasoning, summary, expAudit, gaps, totalMissingMonths, edu, audit, mandatory,
    mandatoryMatched, criticalMissing, briefWhy,
  } = model

  const pad = variant === 'compact' ? 'p-4' : 'p-5'
  const sectionTitle = 'text-xs font-extrabold uppercase tracking-[0.06em] mb-2.5 flex items-center gap-1.5'
  const bodyText = 'text-[15px] font-medium text-slate-800 leading-[1.7] tracking-[-0.01em]'

  return (
    <div className={`srp-prose ${variant === 'compact' ? 'space-y-4 text-slate-800' : 'space-y-0'}`}>
      {showHeader && (
        <div className={`flex items-start gap-4 ${variant === 'card' ? 'px-5 pb-4' : ''}`}>
          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl border-2 ${grade.bg} ${grade.border} shadow-sm`}>
            <span className="text-2xl font-black leading-none" style={{ color: grade.color }}>{score}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">AI Score</span>
            <span className="text-[9px] font-semibold mt-0.5" style={{ color: grade.color }}>{grade.label}</span>
          </div>
          <div className="flex-1 min-w-0">
            {asText(r.name) && (
              <h3 className="text-lg font-extrabold text-slate-900 mb-1 truncate tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>{asText(r.name)}</h3>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge className={`${dc.bg} ${dc.text} ${dc.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
                {decision}
              </Badge>
              {classification && (
                <Badge className={
                  classification.includes('EXCELLENT') || classification === 'STRONG'
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
              {r.resume_score != null && !Number.isNaN(Number(r.resume_score)) && (
                <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Resume: {Math.round(Number(r.resume_score))}%</Badge>
              )}
              {riskLevel && (
                <Badge className={riskTone(riskLevel)}>Risk: {riskLevel}</Badge>
              )}
              {r.interview_probability != null && !Number.isNaN(Number(r.interview_probability)) && (
                <Badge className="bg-violet-50 text-violet-800 border-violet-200">Interview {Math.round(Number(r.interview_probability))}%</Badge>
              )}
              {r.offer_probability != null && !Number.isNaN(Number(r.offer_probability)) && (
                <Badge className="bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200">Offer {Math.round(Number(r.offer_probability))}%</Badge>
              )}
            </div>
            {screenedAtLabel && (
              <p className="text-[10px] text-gray-400 font-mono mt-2">Screened: {screenedAtLabel}</p>
            )}
          </div>
        </div>
      )}

      {/* Brief “what we got” — always visible, crash-safe */}
      <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-indigo-50/40' : 'bg-indigo-50/50 rounded-xl border border-indigo-100'}`}>
        <p className={`${sectionTitle} text-indigo-700`}>
          <Brain className="w-3.5 h-3.5" /> What AI found
        </p>
        <p className={bodyText}>{briefWhy}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-emerald-700 mb-1.5">Matched</p>
            <PillList items={strongSkills.slice(0, 8)} tone="green" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-red-700 mb-1.5">Missing / Gaps</p>
            <PillList items={(criticalMissing.map(m => m.name).length ? criticalMissing.map(m => m.name) : missingSkills).slice(0, 8)} tone="red" />
          </div>
        </div>
        {briefFirst && variant === 'card' && (
          <button
            type="button"
            onClick={() => setShowFull(v => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900"
          >
            {showFull ? 'Hide full audit' : 'Show full audit'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFull ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {showFull && (
        <>
          {summary && summary !== briefWhy && (
            <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100' : 'rounded-xl border border-slate-200'}`}>
              <p className={`${sectionTitle} text-slate-700`}>Executive Summary</p>
              <p className={`${bodyText} whitespace-pre-wrap`}>{summary}</p>
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
                  </div>
                ))}
              </div>
              {mandatoryMatched.length > 0 && (
                <p className="text-[10px] text-emerald-700 mt-2 font-medium">{mandatoryMatched.length}/{mandatory.length} mandatory matched</p>
              )}
            </div>
          )}

          {redFlags.length > 0 && (
            <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-amber-50/40' : 'rounded-xl border border-amber-200 bg-amber-50'}`}>
              <p className={`${sectionTitle} text-amber-900`}>Red Flags</p>
              <ul className="space-y-1.5">
                {redFlags.map((f, i) => (
                  <li key={i} className="text-[14px] font-medium text-amber-950 leading-6 flex gap-2">
                    <span className="text-amber-500 flex-shrink-0">⚠</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preferredSkills.length > 0 && (
            <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-cyan-50/40' : 'rounded-xl border border-cyan-200 bg-cyan-50'}`}>
              <p className={`${sectionTitle} text-cyan-900`}>Preferred / Nice-to-have ★★★</p>
              <PillList items={preferredSkills} tone="cyan" />
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
                    <div className="flex justify-between"><span className="text-gray-500">Claimed</span><span className="font-semibold">{asText(expAudit.claimed_years, '—')} yrs</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Calculated</span><span className="font-semibold">{asText(expAudit.calculated_years, '—')} yrs</span></div>
                    {expAudit.difference_years != null && !Number.isNaN(Number(expAudit.difference_years)) && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Diff</span>
                        <span className={`font-bold ${Math.abs(Number(expAudit.difference_years)) > 1 ? 'text-red-600' : 'text-amber-700'}`}>
                          {asText(expAudit.difference_years)} yrs
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verdict</span>
                      <span className={`font-bold ${asText(expAudit.verdict).toLowerCase().includes('match') ? 'text-emerald-700' : 'text-red-600'}`}>
                        {asText(expAudit.verdict, '—')}
                      </span>
                    </div>
                  </div>
                  {totalMissingMonths > 0 && (
                    <div className="mt-3 pt-2 border-t border-orange-200/60">
                      <p className="text-[11px] font-bold text-orange-800 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Gaps: {totalMissingMonths} mo
                      </p>
                      <ul className="space-y-1">
                        {gaps.slice(0, 4).map((g, i) => {
                          const gap = (g && typeof g === 'object') ? g as Record<string, unknown> : {}
                          return (
                            <li key={i} className="text-[11px] text-gray-600">
                              {asText(gap.from, '?')} → {asText(gap.to, '?')}{gap.months != null ? ` (${asText(gap.months)}mo)` : ''}
                            </li>
                          )
                        })}
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
                      {asText(edu.flag) && <p className="text-amber-800 mt-1">{asText(edu.flag)}</p>}
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
                          {String(label)}: {ok == null ? '—' : ok ? 'Yes' : 'No'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(strengths.length > 0 || weaknesses.length > 0) && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${variant === 'card' ? 'border-t border-gray-100' : 'gap-3'}`}>
              {strengths.length > 0 && (
                <div className={`${pad} ${variant === 'card' ? 'border-r border-gray-100 bg-emerald-50/30' : 'rounded-xl border border-emerald-200 bg-emerald-50'}`}>
                  <p className={`${sectionTitle} text-emerald-800`}><CheckCircle className="w-3.5 h-3.5" /> Strengths</p>
                  <ul className="space-y-1.5">
                    {strengths.map((s, i) => (
                      <li key={i} className="text-[14px] font-medium text-slate-800 leading-6 flex gap-2"><span className="text-emerald-600">✓</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {weaknesses.length > 0 && (
                <div className={`${pad} ${variant === 'card' ? 'bg-red-50/20' : 'rounded-xl border border-red-200 bg-red-50'}`}>
                  <p className={`${sectionTitle} text-red-800`}><AlertCircle className="w-3.5 h-3.5" /> Gaps & Weaknesses</p>
                  <ul className="space-y-1.5">
                    {weaknesses.map((w, i) => (
                      <li key={i} className="text-[14px] font-medium text-slate-800 leading-6 flex gap-2"><span className="text-red-500">×</span><span>{w}</span></li>
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
              <p className={`${bodyText} whitespace-pre-wrap`}>{reasoning}</p>
            </div>
          )}

          {r.recruiter_recommendation && typeof r.recruiter_recommendation === 'object' && (
            <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-violet-50/40' : 'rounded-xl border border-violet-200 bg-violet-50'}`}>
              <p className={`${sectionTitle} text-violet-800`}>Recruiter Recommendation</p>
              <div className="space-y-2 text-[15px] font-medium text-slate-800 leading-7">
                {asText(r.recruiter_recommendation.interview_recommendation) && (
                  <p><span className="font-semibold">Interview:</span> {asText(r.recruiter_recommendation.interview_recommendation)}</p>
                )}
                {asText(r.recruiter_recommendation.hiring_recommendation) && (
                  <p><span className="font-semibold">Hiring:</span> {asText(r.recruiter_recommendation.hiring_recommendation)}</p>
                )}
                {asText(r.recruiter_recommendation.training_recommendation) && (
                  <p><span className="font-semibold">Training:</span> {asText(r.recruiter_recommendation.training_recommendation)}</p>
                )}
                {asStringList(r.recruiter_recommendation.suitable_roles).length > 0 && (
                  <p><span className="font-semibold">Suitable roles:</span> {asStringList(r.recruiter_recommendation.suitable_roles).join(', ')}</p>
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
                  <li key={i} className="text-[15px] font-medium text-slate-800 leading-7 flex gap-2">
                    <span className="font-bold text-blue-500">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {asText(ev?.risk_explanation) && (
            <div className={`${pad} ${variant === 'card' ? 'border-t border-gray-100 bg-gray-50' : ''}`}>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[15px] font-medium text-slate-800 leading-7"><span className="font-extrabold text-amber-800">Risk Note: </span>{asText(ev?.risk_explanation)}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
