'use client'

import { PAIN_POINTS, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import {
  FileStack,
  Copy,
  Clock,
  MessageSquareWarning,
  UserX,
  FolderOpen,
} from 'lucide-react'

const ICONS = [FileStack, Copy, Clock, MessageSquareWarning, UserX, FolderOpen]

export default function AgencyPainPointCards() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.painPoints}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-marketing-navy-mid marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-14">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {PAIN_POINTS.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            {PAIN_POINTS.title}
          </h2>
          <p className="mt-4 text-slate-400 text-lg">{PAIN_POINTS.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PAIN_POINTS.items.map((item, i) => {
            const Icon = ICONS[i] ?? FileStack
            return (
              <article
                key={item.title}
                className="marketing-glass rounded-2xl p-6 hover:shadow-marketing-glow transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
