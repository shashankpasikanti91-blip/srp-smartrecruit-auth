'use client'

import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

type StackedCards3DProps = {
  className?: string
}

/** Lightweight CSS 3D card stack — simplified on mobile / reduced motion. */
export default function StackedCards3D({ className = '' }: StackedCards3DProps) {
  const reduced = useReducedMotion()

  return (
    <div
      className={`relative w-full max-w-md mx-auto aspect-[4/3] perspective-[1200px] ${className}`}
      aria-hidden
    >
      <div
        className={`absolute inset-0 flex items-center justify-center ${reduced ? '' : 'marketing-float-slow'}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute w-[78%] h-[62%] rounded-2xl marketing-glass border border-white/10 shadow-marketing-card"
          style={{ transform: 'translateZ(-40px) rotateY(-6deg) rotateX(4deg)' }}
        />
        <div
          className="absolute w-[82%] h-[66%] rounded-2xl marketing-glass border border-cyan-500/15 shadow-marketing-card"
          style={{ transform: 'translateZ(-10px) rotateY(-3deg) rotateX(2deg)' }}
        />
        <div
          className="absolute w-[86%] h-[70%] rounded-2xl marketing-glass border border-violet-500/20 shadow-marketing-glow p-5"
          style={{ transform: 'translateZ(20px) rotateY(2deg)' }}
        >
          <div className="h-2 w-24 rounded bg-white/20 mb-4" />
          <div className="space-y-2">
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-4/5 rounded bg-white/08" />
            <div className="flex gap-2 mt-4">
              <span className="px-2 py-1 rounded-md text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">React</span>
              <span className="px-2 py-1 rounded-md text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/25">8 yrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
