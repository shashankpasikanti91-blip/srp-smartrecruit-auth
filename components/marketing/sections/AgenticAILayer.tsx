'use client'

import { AGENTIC, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import { Bot, Eye, ListOrdered } from 'lucide-react'

const ICONS = [Bot, Eye, ListOrdered]

export default function AgenticAILayer() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.agentic}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-marketing-navy-mid marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">
              {AGENTIC.eyebrow}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white leading-tight">
              {AGENTIC.title}
            </h2>
            <p className="mt-4 text-slate-400 text-lg leading-relaxed">{AGENTIC.subtitle}</p>
          </div>
          <ul className="space-y-4">
            {AGENTIC.points.map((point, i) => {
              const Icon = ICONS[i] ?? Bot
              return (
                <li
                  key={point.title}
                  className="marketing-glass rounded-xl p-5 flex gap-4 hover:border-violet-500/20 transition-colors"
                >
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-300">
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm mb-1">{point.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{point.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
