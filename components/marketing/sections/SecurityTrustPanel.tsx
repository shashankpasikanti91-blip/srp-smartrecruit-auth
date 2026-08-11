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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F97316] mb-4">{TRUST.eyebrow}</p>
            <h2 className="font-display text-display-lg font-extrabold text-white">{TRUST.title}</h2>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">{TRUST.subtitle}</p>
            <Link href="/legal/security" className="inline-block mt-8 text-sm font-semibold text-[#F97316] hover:text-orange-300">
              Security & data protection →
            </Link>
          </div>
          <ul className="space-y-6">
            {TRUST.items.map((item, i) => (
              <li key={item.title} className="flex gap-5">
                <span className="w-8 h-8 rounded-md bg-[#166534] text-[#F97316] text-sm font-bold flex items-center justify-center shrink-0" aria-hidden>{i + 1}</span>
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
