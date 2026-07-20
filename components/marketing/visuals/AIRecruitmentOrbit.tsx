'use client'

import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

export default function AIRecruitmentOrbit({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div
      className={`relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center mx-auto ${className}`}
      aria-hidden="true"
    >
      <div
        className={`absolute inset-0 rounded-full border border-cyan-500/20 ${reduced ? '' : 'marketing-orb-pulse'}`}
        style={{ boxShadow: '0 0 60px rgba(34,211,238,0.25)' }}
      />
      <div className="absolute inset-2 rounded-full border border-violet-500/30 border-dashed" />
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/30 via-violet-600/40 to-emerald-500/20 blur-sm" />
      <div className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-violet-700 flex items-center justify-center shadow-marketing-glow">
        <span className="text-[10px] md:text-xs font-bold text-white text-center leading-tight px-1">
          AI<br />Match
        </span>
      </div>
      {!reduced && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 marketing-pipeline-dot" />
          <div
            className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 marketing-pipeline-dot"
            style={{ animationDelay: '0.5s' }}
          />
        </>
      )}
    </div>
  )
}
