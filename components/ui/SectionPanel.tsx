'use client'

import type { ReactNode } from 'react'

const PANEL_BASE =
  'rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.02]'

export function SectionPanel({
  children,
  className = '',
  title,
  subtitle,
  actions,
  padding = true,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  padding?: boolean
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={`${PANEL_BASE} ${padding ? 'p-5 sm:p-6' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <div className={`flex items-start justify-between gap-3 ${padding ? 'mb-4' : 'px-5 sm:px-6 pt-5 sm:pt-6 mb-4'}`}>
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  )
}

export function InnerBlock({
  children,
  className = '',
  title,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 ${className}`.trim()}
    >
      {title && (
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

/** Canonical class string for ad-hoc wrappers that cannot use SectionPanel. */
export const sectionPanelClass = PANEL_BASE
