'use client'

import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="dash-section-head">
      <div className="flex items-start gap-4 min-w-0">
        {icon && <div className="dash-section-icon">{icon}</div>}
        <div className="min-w-0">
          <h1
            className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            {title}
          </h1>
          {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
}) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50/80',
    primary: 'border-indigo-200 bg-indigo-50/60',
    success: 'border-emerald-200 bg-emerald-50/60',
    warning: 'border-amber-200 bg-amber-50/60',
    danger: 'border-rose-200 bg-rose-50/60',
  }
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] font-medium text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
