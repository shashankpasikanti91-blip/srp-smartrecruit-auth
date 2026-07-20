'use client'

import {
  ArrowRight, Briefcase, CheckCircle2, ClipboardList, FileCheck,
  Handshake, UserCheck, Users,
} from 'lucide-react'

export const WORKFLOW_STAGES = [
  { key: 'requirement', label: 'Requirement', icon: ClipboardList },
  { key: 'job', label: 'Job', icon: Briefcase },
  { key: 'candidates', label: 'Candidates', icon: Users },
  { key: 'submissions', label: 'Submissions', icon: FileCheck },
  { key: 'interviews', label: 'Interviews', icon: UserCheck },
  { key: 'offers', label: 'Offers', icon: Handshake },
  { key: 'joining', label: 'Joining', icon: ArrowRight },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
] as const

export type WorkflowStageKey = typeof WORKFLOW_STAGES[number]['key']

export function VisualWorkflow({
  counts,
  onStageClick,
  className = '',
}: {
  counts: Record<string, number>
  onStageClick?: (stage: string) => void
  className?: string
}) {
  const clickable = !!onStageClick

  return (
    <div className={`ess-panel overflow-hidden ${className}`}>
      <div className="ess-panel__head">
        <p className="ess-panel__title">Recruitment workflow</p>
        <p className="text-[10px] font-bold text-slate-400 hidden sm:block">Click a stage to filter</p>
      </div>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-stretch gap-0 p-4 overflow-x-auto">
        {WORKFLOW_STAGES.map((stage, i) => {
          const Icon = stage.icon
          const count = counts[stage.key] ?? 0
          return (
            <div key={stage.key} className="flex items-center shrink-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStageClick?.(stage.key)}
                className={`group flex flex-col items-center min-w-[88px] px-2 py-2 rounded-xl transition-colors ${
                  clickable ? 'hover:bg-indigo-50 cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  count > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                } group-hover:border-indigo-300 transition-colors`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xl font-extrabold text-slate-900 mt-2 tabular-nums">{count}</span>
                <span className="text-[10px] font-extrabold text-slate-500 text-center leading-tight mt-0.5">{stage.label}</span>
              </button>
              {i < WORKFLOW_STAGES.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-0.5 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
      {/* Mobile: vertical */}
      <div className="md:hidden divide-y divide-slate-100">
        {WORKFLOW_STAGES.map(stage => {
          const Icon = stage.icon
          const count = counts[stage.key] ?? 0
          return (
            <button
              key={stage.key}
              type="button"
              disabled={!clickable}
              onClick={() => onStageClick?.(stage.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                clickable ? 'hover:bg-indigo-50/60 active:bg-indigo-50' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${
                count > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-extrabold text-slate-800">{stage.label}</span>
              <span className="text-lg font-extrabold text-slate-900 tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
