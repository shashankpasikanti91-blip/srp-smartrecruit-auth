'use client'

import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { FEATURES_PAGE } from '@/content/marketing/features'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function FeatureWorkflowSection() {
  const { sticky } = FEATURES_PAGE
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="workflow" variant="mid" className="py-16 lg:py-20 scroll-mt-24">
      <div ref={ref} className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">{sticky.eyebrow}</p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white text-balance">{sticky.title}</h2>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {sticky.steps.map((step, i) => (
            <li
              key={step.label}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 lg:p-6"
            >
              <span className="text-xs font-mono text-cyan-400/80">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 font-semibold text-white">{step.label}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </CinematicSection>
  )
}
