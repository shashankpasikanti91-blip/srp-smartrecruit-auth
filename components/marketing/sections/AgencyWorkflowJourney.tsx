'use client'

import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { JOURNEY } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

const STAGE_COLORS = [
  'from-cyan-400 to-cyan-500',
  'from-cyan-400 to-violet-500',
  'from-violet-400 to-violet-500',
  'from-violet-400 to-emerald-400',
  'from-emerald-400 to-emerald-500',
  'from-emerald-400 to-emerald-500',
]

export default function AgencyWorkflowJourney() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="workflow" variant="mid" className="py-16 lg:py-20">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">{JOURNEY.eyebrow}</p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">{JOURNEY.title}</h2>
        </div>

        <div className="hidden md:grid md:grid-cols-6 gap-3">
          {JOURNEY.stages.map((stage, i) => (
            <div key={stage} className="relative flex flex-col items-center text-center">
              {i < JOURNEY.stages.length - 1 && (
                <div
                  className="absolute top-5 left-[calc(50%+1.25rem)] right-0 h-px bg-gradient-to-r from-white/20 to-transparent"
                  aria-hidden
                />
              )}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${STAGE_COLORS[i]} flex items-center justify-center text-xs font-bold text-marketing-black shadow-lg shadow-cyan-500/10`}>
                {i + 1}
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{stage}</p>
            </div>
          ))}
        </div>

        <ol className="md:hidden space-y-3">
          {JOURNEY.stages.map((s, i) => (
            <li key={s} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${STAGE_COLORS[i]} text-marketing-black text-sm font-bold flex items-center justify-center shrink-0`}>
                {i + 1}
              </span>
              <span className="text-white font-medium">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </CinematicSection>
  )
}
