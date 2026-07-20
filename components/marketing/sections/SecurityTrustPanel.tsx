'use client'

import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { TRUST } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import Link from 'next/link'

export default function SecurityTrustPanel() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="trust" variant="bleed" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-4">{TRUST.eyebrow}</p>
            <h2 className="font-display text-display-lg font-extrabold text-white">{TRUST.title}</h2>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">{TRUST.subtitle}</p>
            <Link href="/legal/security" className="inline-block mt-8 text-sm font-semibold text-cyan-400 hover:text-cyan-300">
              Security & data protection →
            </Link>
          </div>
          <ul className="space-y-6">
            {TRUST.items.map((item, i) => (
              <li key={item.title} className="flex gap-5">
                <span className="text-2xl font-light text-cyan-500/50 tabular-nums">0{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CinematicSection>
  )
}
