'use client'

import { WORKFLOW } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function PipelineJourney() {
  const { ref, isVisible } = useInViewReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="relative">
        <div
          className="hidden lg:block absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"
          aria-hidden
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 list-none">
          {WORKFLOW.stages.map((stage, i) => (
            <li key={stage.id} className="relative">
              <div className="marketing-glass rounded-xl p-4 h-full hover:shadow-marketing-glow transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-bold text-white">{stage.label}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{stage.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
