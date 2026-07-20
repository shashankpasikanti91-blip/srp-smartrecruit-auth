'use client'

import Image from 'next/image'
import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

/** Layered static marketing mockup — not connected to live dashboard. */
export default function CommandCenterLayers() {
  const reduced = useReducedMotion()

  return (
    <div className="relative max-w-4xl mx-auto aspect-[4/3] marketing-scene-3d" aria-label="Recruitment command center product preview mockup">
      <div className={`relative h-full ${reduced ? '' : 'marketing-scene-inner'}`}>
        <div className="absolute top-0 left-0 w-[55%] z-10 marketing-glass rounded-2xl p-4 border border-cyan-500/20 shadow-marketing-glow">
          <p className="text-[10px] text-slate-500 uppercase mb-2">Candidate ranking</p>
          <Image src="/marketing/recruit-ai/candidate-ranking-panel.svg" alt="" width={400} height={200} className="w-full h-auto rounded-lg" aria-hidden />
        </div>
        <div className="absolute top-[20%] right-0 w-[45%] z-20 marketing-glass rounded-2xl p-4 border border-violet-500/25" style={{ transform: 'translateZ(30px)' }}>
          <p className="text-[10px] text-slate-500 uppercase mb-2">Match score</p>
          <div className="flex justify-center"><ScoreRing score={86} size={80} /></div>
        </div>
        <div className="absolute bottom-0 left-[10%] w-[50%] z-30 marketing-glass rounded-2xl p-3 border border-emerald-500/25">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Client submission pack</p>
          <Image src="/marketing/recruit-ai/client-shortlist-preview.svg" alt="" width={320} height={180} className="w-full h-auto rounded-lg opacity-90" aria-hidden />
        </div>
        <div className="absolute bottom-[15%] right-[5%] w-[35%] z-40 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200">
          Duplicate profile flagged — review merge
        </div>
      </div>
    </div>
  )
}
