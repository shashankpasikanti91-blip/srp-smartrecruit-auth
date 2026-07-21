'use client'

import type { ReactNode } from 'react'
import { Download, RefreshCw, Search } from 'lucide-react'
import { DATE_PRESET_OPTIONS, type DatePreset } from '@/lib/datePresets'

export type OpsPill = {
  id: string
  label: string
  count?: number
}

export function OpsListChrome({
  title,
  subtitle,
  scopeMine,
  onToggleMine,
  showMineToggle,
  preset,
  onPreset,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  pills,
  activePill,
  onPill,
  onExportCsv,
  onExportXlsx,
  onRefresh,
  children,
}: {
  title?: string
  subtitle?: string
  scopeMine?: boolean
  onToggleMine?: (v: boolean) => void
  showMineToggle?: boolean
  preset: DatePreset | string
  onPreset: (v: DatePreset) => void
  dateFrom?: string
  dateTo?: string
  onDateFrom?: (v: string) => void
  onDateTo?: (v: string) => void
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  pills?: OpsPill[]
  activePill?: string
  onPill?: (id: string) => void
  onExportCsv?: () => void
  onExportXlsx?: () => void
  onRefresh?: () => void
  children?: ReactNode
}) {
  return (
    <div className="space-y-3 mb-4">
      {(scopeMine || showMineToggle) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-950 flex flex-wrap items-center justify-between gap-2">
          <span>
            {scopeMine
              ? 'Your work only — Candidates, submissions, interviews, and KPIs are yours only. Jobs and Clients are shared.'
              : 'Full workspace view — managers and admins see the team queue.'}
          </span>
          {showMineToggle && onToggleMine && (
            <button
              type="button"
              onClick={() => onToggleMine(!scopeMine)}
              className="text-xs font-extrabold px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
            >
              {scopeMine ? 'Show all (team)' : 'My work only'}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESET_OPTIONS.map(p => (
          <button
            key={p.value || 'all'}
            type="button"
            onClick={() => onPreset(p.value)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-colors ${
              preset === p.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {onDateFrom && (
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">From</label>
            <input
              type="date"
              value={dateFrom ?? ''}
              onChange={e => onDateFrom(e.target.value)}
              className="form-input !py-1.5 !text-sm !w-auto"
            />
          </div>
        )}
        {onDateTo && (
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">To</label>
            <input
              type="date"
              value={dateTo ?? ''}
              onChange={e => onDateTo(e.target.value)}
              className="form-input !py-1.5 !text-sm !w-auto"
            />
          </div>
        )}
        {onSearch && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search ?? ''}
              onChange={e => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="form-input !py-1.5 !text-sm w-full pl-8"
            />
          </div>
        )}
        <div className="flex gap-1.5 ml-auto">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
          {onExportXlsx && (
            <button
              type="button"
              onClick={onExportXlsx}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          )}
        </div>
      </div>

      {pills && pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPill?.(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${
                activePill === p.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p.label}
              {typeof p.count === 'number' ? (
                <span className={`ml-1.5 tabular-nums ${activePill === p.id ? 'text-white/80' : 'text-slate-500'}`}>
                  ({p.count})
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {(title || subtitle) && (
        <div>
          {title ? <p className="text-sm font-extrabold text-slate-900">{title}</p> : null}
          {subtitle ? <p className="text-xs font-medium text-slate-500">{subtitle}</p> : null}
        </div>
      )}

      {children}
    </div>
  )
}
