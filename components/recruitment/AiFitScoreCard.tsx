'use client'

import type { AiFitScores } from '@/lib/aiFitScore'
import { Sparkles } from 'lucide-react'

type ScoreKey = Exclude<keyof AiFitScores, 'computed_at' | 'job_id' | 'rationale'>

const DIMENSIONS: { key: ScoreKey; label: string }[] = [
  { key: 'skill_match', label: 'Skills' },
  { key: 'experience_match', label: 'Experience' },
  { key: 'domain_match', label: 'Domain' },
  { key: 'location_match', label: 'Location' },
  { key: 'notice_match', label: 'Notice' },
  { key: 'salary_match', label: 'Salary' },
  { key: 'communication_score', label: 'Communication' },
  { key: 'resume_quality', label: 'Resume' },
  { key: 'interview_score', label: 'Interview' },
]

function barTone(n: number) {
  if (n >= 80) return 'bg-emerald-500'
  if (n >= 60) return 'bg-indigo-500'
  if (n >= 40) return 'bg-amber-500'
  return 'bg-rose-500'
}

function overallTone(n: number) {
  if (n >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (n >= 60) return 'text-indigo-700 bg-indigo-50 border-indigo-200'
  if (n >= 40) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-rose-700 bg-rose-50 border-rose-200'
}

function ScoreBar({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold text-slate-600 ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
        <span className={`font-extrabold text-slate-800 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'}`}>{v}</span>
      </div>
      <div className={`w-full rounded-full bg-slate-100 overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}>
        <div
          className={`h-full rounded-full transition-all ${barTone(v)}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

export function AiFitScoreCard({
  scores,
  compact = false,
  className = '',
}: {
  scores: Pick<AiFitScores, ScoreKey> & Partial<Pick<AiFitScores, 'rationale' | 'computed_at'>>
  compact?: boolean
  className?: string
}) {
  const overall = Math.max(0, Math.min(100, Math.round(scores.overall ?? 0)))

  if (compact) {
    return (
      <div className={`ess-panel !p-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center font-extrabold text-lg ${overallTone(overall)}`}>
            {overall}
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {DIMENSIONS.slice(0, 4).map(d => (
              <ScoreBar key={d.key} label={d.label} value={scores[d.key] ?? 0} compact />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`ess-panel ${className}`}>
      <div className="ess-panel__head">
        <p className="ess-panel__title flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" /> AI Fit Scorecard
        </p>
        {scores.computed_at && (
          <span className="text-[10px] font-bold text-slate-400">
            {new Date(scores.computed_at).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-5">
          <div className={`shrink-0 w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center ${overallTone(overall)}`}>
            <span className="text-3xl font-extrabold leading-none">{overall}</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 opacity-80">Overall</span>
          </div>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            Multi-dimensional match across skills, experience, domain, location, notice, salary, communication, resume quality, and interview signals.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {DIMENSIONS.map(d => (
            <ScoreBar key={d.key} label={d.label} value={scores[d.key] ?? 0} />
          ))}
        </div>
        {scores.rationale && Object.keys(scores.rationale).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Rationale</p>
            <ul className="space-y-1">
              {Object.entries(scores.rationale).slice(0, 4).map(([k, v]) => (
                <li key={k} className="text-[11px] font-medium text-slate-500">
                  <span className="font-extrabold text-slate-700 capitalize">{k.replace(/_/g, ' ')}:</span> {v}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
