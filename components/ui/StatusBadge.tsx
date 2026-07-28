'use client'

import type { ReactNode } from 'react'

const TONES: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-rose-50 text-rose-800 border-rose-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  primary: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  open: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  processing: 'bg-blue-50 text-blue-800 border-blue-200',
  hold: 'bg-amber-50 text-amber-900 border-amber-200',
  kiv: 'bg-slate-100 text-slate-700 border-slate-300',
  closed: 'bg-slate-200 text-slate-600 border-slate-300',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  hired: 'bg-teal-50 text-teal-800 border-teal-200',
  submitted: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  interview: 'bg-violet-50 text-violet-800 border-violet-200',
  offer: 'bg-amber-50 text-amber-900 border-amber-200',
  joined: 'bg-teal-50 text-teal-800 border-teal-200',
  expired: 'bg-rose-50 text-rose-800 border-rose-200',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  expiring: 'bg-amber-50 text-amber-900 border-amber-200',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: keyof typeof TONES | string
  className?: string
}) {
  const cls = TONES[tone] ?? TONES.neutral
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${cls} ${className}`}>
      {children}
    </span>
  )
}
