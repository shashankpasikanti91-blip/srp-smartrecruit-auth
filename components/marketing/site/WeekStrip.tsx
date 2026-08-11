'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WEEK_STRIP } from '@/content/marketing/siteStory'

const INTERVAL_MS = 8000

export default function WeekStrip() {
  const n = WEEK_STRIP.length
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduce(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (reduce || paused) return
    const id = window.setInterval(() => setActive((i) => (i + 1) % n), INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [paused, n, reduce])

  const beat = WEEK_STRIP[active]

  return (
    <section
      id="week"
      className="bg-[#0B1F14] text-[#FCFCFA] py-14 sm:py-20"
      aria-label="Screen, match, review, send, jobs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#F97316] font-semibold">The desk</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl max-w-2xl leading-tight">Screen. Match. Review. Send. Jobs.</h2>

        {reduce ? (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
            {WEEK_STRIP.map((b, i) => (
              <article key={b.label}>
                <p className="font-display text-4xl text-[#F97316]/80 leading-none">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-4 text-lg font-semibold">{b.label}</h3>
                <ul className="mt-4 space-y-2">
                  {b.points.map((p) => (
                    <li key={p} className="text-sm text-white/70 leading-relaxed">{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-12">
            <div className="flex flex-wrap gap-1 mb-10" role="tablist" aria-label="Desk steps">
              {WEEK_STRIP.map((b, i) => (
                <button
                  key={b.label}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={`relative min-w-[4.5rem] flex-1 text-left px-1 py-2 text-sm font-semibold min-h-[44px] ${
                    i === active ? 'text-[#FCFCFA]' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {b.label}
                  <span className="mt-2 block h-px w-full overflow-hidden bg-white/15">
                    <span
                      className="block h-full bg-[#F97316]"
                      style={
                        i === active
                          ? {
                              width: '100%',
                              animation: `week-fill ${INTERVAL_MS}ms linear`,
                              animationPlayState: paused ? 'paused' : 'running',
                            }
                          : { width: '0%' }
                      }
                    />
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-h-[220px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.article
                  key={beat.label}
                  initial={{ x: 56, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -56, opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="font-display text-5xl text-[#F97316]/80 leading-none">{String(active + 1).padStart(2, '0')}</p>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-semibold">{beat.label}</h3>
                  <p className="mt-2 text-white/55">{beat.caption}</p>
                  <ul className="mt-6 grid sm:grid-cols-3 gap-6">
                    {beat.points.map((p) => (
                      <li key={p} className="text-[15px] text-white/85 leading-relaxed">{p}</li>
                    ))}
                  </ul>
                </motion.article>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
