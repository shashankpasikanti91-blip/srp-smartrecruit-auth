'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PRODUCT_MODULES, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function FeatureBentoGrid() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.modules}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-marketing-navy-mid marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-14">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {PRODUCT_MODULES.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            {PRODUCT_MODULES.title}
          </h2>
          <p className="mt-4 text-slate-400 text-lg">{PRODUCT_MODULES.subtitle}</p>
          <Link
            href="/features"
            className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
          >
            Explore all features <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
          {PRODUCT_MODULES.items.map((mod) => (
            <article
              key={mod.title}
              className={`marketing-glass rounded-2xl p-6 hover:shadow-marketing-glow transition-all duration-300 hover:border-cyan-500/20 ${
                mod.span === 'large' ? 'md:col-span-2' : ''
              }`}
            >
              <h3 className="text-base font-bold text-white mb-2">{mod.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{mod.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
