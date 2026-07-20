'use client'

import MarketingVisual from '@/components/marketing/ui/MarketingVisual'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

export default function CommandCenterVisual() {
  const reduced = useReducedMotion()

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className={`relative z-10 ${reduced ? '' : 'marketing-float-slow'}`}>
        <MarketingVisual
          src="/marketing/recruit-ai/pipeline-command-center.svg"
          alt="Layered recruitment command center dashboard with pipeline, analytics, and workspace panels"
          width={560}
          height={400}
          className="rounded-2xl shadow-marketing-glow"
          priority
        />
      </div>
      <div
        className="absolute -bottom-6 -right-4 w-32 h-32 rounded-2xl marketing-glass border border-emerald-500/25 p-3 hidden sm:block"
        style={{ transform: 'rotate(4deg)' }}
        aria-hidden
      >
        <div className="text-[10px] text-emerald-300 font-semibold mb-2">Pipeline</div>
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded bg-emerald-500/30" />
          <div className="h-1.5 w-3/4 rounded bg-white/10" />
        </div>
      </div>
    </div>
  )
}
