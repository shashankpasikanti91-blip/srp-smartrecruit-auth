'use client'

import Link from 'next/link'
import { TRUST, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import { Shield, Users, ScrollText, UserCheck } from 'lucide-react'

const ICONS = [Shield, Users, ScrollText, UserCheck]

export default function TrustAndSecurityPanel() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.trust}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 marketing-grid-bg marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {TRUST.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            {TRUST.title}
          </h2>
          <p className="mt-4 text-slate-400 text-lg">{TRUST.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {TRUST.items.map((item, i) => {
            const Icon = ICONS[i] ?? Shield
            return (
              <article key={item.title} className="marketing-glass rounded-2xl p-6 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 mx-auto sm:mx-0">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <h3 className="font-bold text-white text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
              </article>
            )
          })}
        </div>

        <p className="text-center text-sm text-slate-500">
          Read our{' '}
          <Link href="/legal/security" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            security practices
          </Link>{' '}
          for details on data handling and access controls.
        </p>
      </div>
    </section>
  )
}
