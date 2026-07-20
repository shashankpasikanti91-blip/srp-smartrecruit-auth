'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { PRICING } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

type PremiumPricingSectionProps = {
  showAllPlans?: boolean
}

export default function PremiumPricingSection({ showAllPlans = true }: PremiumPricingSectionProps) {
  const { ref, isVisible } = useInViewReveal()
  const plans = showAllPlans ? PRICING.plans : PRICING.plans.filter((p) => p.highlighted)

  return (
    <CinematicSection id="pricing" variant="mid" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-3">{PRICING.eyebrow}</p>
          <h2 className="font-display text-display-lg font-extrabold text-white">{PRICING.title}</h2>
          <p className="mt-4 text-slate-400">{PRICING.subtitle}</p>
        </div>
        <div className={`grid gap-5 ${showAllPlans ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' : 'max-w-lg mx-auto'}`}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col h-full ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-cyan-500/10 to-violet-600/10 border-2 border-cyan-500/40 shadow-cinematic-glow scale-[1.02]'
                  : 'border border-white/10 bg-white/[0.02]'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gradient-to-r from-cyan-500 to-violet-600 text-white">
                  Best for agencies
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-3xl font-extrabold text-white">{plan.price}<span className="text-sm font-normal text-slate-500"> / {plan.period}</span></p>
              <p className="text-sm text-slate-500 mt-2 mb-6">{plan.description}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.slice(0, showAllPlans ? undefined : 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />{f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`block text-center py-3 rounded-xl font-semibold text-sm ${
                  plan.highlighted ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white btn-glow' : 'border border-white/15 text-white hover:bg-white/5'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        {!showAllPlans && (
          <p className="text-center mt-8">
            <Link href="/pricing" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">Compare all plans →</Link>
          </p>
        )}
      </div>
    </CinematicSection>
  )
}
