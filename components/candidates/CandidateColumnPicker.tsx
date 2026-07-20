'use client'

import { useEffect, useRef, useState } from 'react'
import { Columns3 } from 'lucide-react'
import {
  CANDIDATE_COLUMNS,
  type CandidateColumnKey,
  loadCandidateColumnPrefs,
  saveCandidateColumnPrefs,
} from '@/lib/candidateColumnPrefs'

export function CandidateColumnPicker({
  visible,
  onChange,
}: {
  visible: Set<CandidateColumnKey>
  onChange: (cols: Set<CandidateColumnKey>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (key: CandidateColumnKey) => {
    const next = new Set(visible)
    if (next.has(key)) {
      if (next.size <= 3) return
      next.delete(key)
    } else {
      next.add(key)
    }
    saveCandidateColumnPrefs(next)
    onChange(next)
  }

  const reset = () => {
    const all = new Set(CANDIDATE_COLUMNS.map(c => c.key))
    saveCandidateColumnPrefs(all)
    onChange(all)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50"
      >
        <Columns3 className="w-3.5 h-3.5" /> Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-slate-200 bg-white shadow-lg p-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Visible columns</p>
          {CANDIDATE_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                onChange={() => toggle(col.key)}
              />
              {col.label}
            </label>
          ))}
          <button type="button" onClick={reset} className="w-full mt-1 text-xs text-indigo-600 hover:underline py-1">
            Reset all
          </button>
        </div>
      )}
    </div>
  )
}
