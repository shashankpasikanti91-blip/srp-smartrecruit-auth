'use client'

/** Shared skeleton loaders — use .skeleton-block from globals.css */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm" aria-hidden>
      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} className="p-3 border-b border-slate-100">
            <div className="skeleton-block h-3 w-20" />
          </div>
        ))}
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={`c-${i}`} className="p-3 border-b border-slate-50">
            <div className="skeleton-block h-3 w-full max-w-[90%]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex justify-between">
            <div className="skeleton-block h-9 w-9 rounded-xl" />
            <div className="skeleton-block h-8 w-24" />
          </div>
          <div className="skeleton-block h-4 w-2/3" />
          <div className="skeleton-block h-3 w-full" />
          <div className="flex gap-2 pt-2">
            <div className="skeleton-block h-8 w-16" />
            <div className="skeleton-block h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-xl" aria-hidden>
      <div className="skeleton-block h-5 w-40" />
      <div className="skeleton-block h-10 w-full" />
      <div className="skeleton-block h-10 w-full" />
      <div className="skeleton-block h-24 w-full" />
      <div className="skeleton-block h-10 w-32" />
    </div>
  )
}

export function KpiStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
          <div className="skeleton-block h-2.5 w-16" />
          <div className="skeleton-block h-7 w-12" />
        </div>
      ))}
    </div>
  )
}
