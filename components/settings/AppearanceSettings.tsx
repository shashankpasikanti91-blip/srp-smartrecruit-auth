'use client'

import { useEffect, useState } from 'react'
import {
  applyAppearance,
  readAppearanceTheme,
  readAppearanceType,
  saveAppearanceTheme,
  saveAppearanceType,
  type AppearanceTheme,
  type AppearanceType,
} from '@/lib/appearance'

/**
 * Settings → Appearance: colour + typography toggles (localStorage).
 */
export function AppearanceSettings() {
  const [theme, setTheme] = useState<AppearanceTheme>('navy')
  const [type, setType] = useState<AppearanceType>('modern')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const t = readAppearanceTheme()
      const ty = readAppearanceType()
      setTheme(t)
      setType(ty)
      applyAppearance(t, ty)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold text-[var(--dash-heading)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
        Appearance
      </h2>
      <p className="mt-1 text-sm text-[var(--dash-text-2)]">
        Calm colours and typography. Changes apply immediately and stay on this device.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dash-text-3)] mb-2">Colour</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setTheme('navy'); saveAppearanceTheme('navy') }}
              className={`text-left rounded-xl border px-3 py-2.5 transition ${
                theme === 'navy'
                  ? 'border-[var(--color-secondary)] bg-[var(--dash-bg)] ring-2 ring-[var(--dash-ring)]'
                  : 'border-[var(--dash-border)] hover:border-slate-300'
              }`}
            >
              <span className="font-bold text-sm text-[var(--dash-heading)]">Navy Calm</span>
              <span className="block text-xs text-[var(--dash-text-2)] mt-0.5">Navy + white — peaceful ESS style</span>
              <span className="mt-2 flex gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-[#0B1F3A]" />
                <span className="h-3 w-6 rounded-sm bg-[#F7F9FC] border border-slate-200" />
                <span className="h-3 w-6 rounded-sm bg-[#3B82C4]" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setTheme('forest'); saveAppearanceTheme('forest') }}
              className={`text-left rounded-xl border px-3 py-2.5 transition ${
                theme === 'forest'
                  ? 'border-[var(--color-secondary)] bg-[var(--dash-bg)] ring-2 ring-[var(--dash-ring)]'
                  : 'border-[var(--dash-border)] hover:border-slate-300'
              }`}
            >
              <span className="font-bold text-sm text-[var(--dash-heading)]">Forest Classic</span>
              <span className="block text-xs text-[var(--dash-text-2)] mt-0.5">Green + saffron brand</span>
              <span className="mt-2 flex gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-[#0B1F14]" />
                <span className="h-3 w-6 rounded-sm bg-[#FCFCFA] border border-slate-200" />
                <span className="h-3 w-6 rounded-sm bg-[#F97316]" />
              </span>
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dash-text-3)] mb-2">Typography</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setType('modern'); saveAppearanceType('modern') }}
              className={`text-left rounded-xl border px-3 py-2.5 transition ${
                type === 'modern'
                  ? 'border-[var(--color-secondary)] bg-[var(--dash-bg)] ring-2 ring-[var(--dash-ring)]'
                  : 'border-[var(--dash-border)] hover:border-slate-300'
              }`}
            >
              <span className="font-bold text-sm text-[var(--dash-heading)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Modern
              </span>
              <span className="block text-xs text-[var(--dash-text-2)] mt-0.5">Plus Jakarta Sans — clean ESS</span>
            </button>
            <button
              type="button"
              onClick={() => { setType('classic'); saveAppearanceType('classic') }}
              className={`text-left rounded-xl border px-3 py-2.5 transition ${
                type === 'classic'
                  ? 'border-[var(--color-secondary)] bg-[var(--dash-bg)] ring-2 ring-[var(--dash-ring)]'
                  : 'border-[var(--dash-border)] hover:border-slate-300'
              }`}
            >
              <span className="font-bold text-sm text-[var(--dash-heading)]" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                Classic
              </span>
              <span className="block text-xs text-[var(--dash-text-2)] mt-0.5">Times New Roman + Carlito</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
