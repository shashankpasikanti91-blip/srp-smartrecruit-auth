'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { PRICING, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function PricingShowcase() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.pricing}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-marketing-navy-mid marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {PRICING.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            {PRICING.title}
          </h2>
          <p className="mt-4 text-slate-400 text-lg">{PRICING.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          {PRICING.plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-cyan-500/15 via-violet-600/10 to-marketing-navy border-2 border-cyan-500/40 shadow-marketing-glow scale-[1.02] z-10'
                  : 'marketing-glass'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-bold">
                    Best for agencies
                  </span>
                </div>
              )}
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                <span className="text-slate-500 text-sm mb-1">/ {plan.period}</span>
              </div>
              <p className="mt-2 text-slate-500 text-sm">{plan.description}</p>
              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`mt-8 w-full py-3 rounded-xl text-center font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white btn-glow'
                    : 'marketing-glass text-white hover:border-cyan-500/30 border border-white/10'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
