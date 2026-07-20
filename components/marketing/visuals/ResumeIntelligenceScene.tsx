'use client'

import CandidateFlowScene from '@/components/marketing/visuals/CandidateFlowScene'

/** Full hero recruitment intelligence scene — CV in, AI core, ranked out. */
export default function ResumeIntelligenceScene() {
  return (
    <div className="relative w-full" aria-hidden>
      <div className="absolute inset-0 glow-orbit-bg rounded-3xl" />
      <div className="relative z-10">
        <CandidateFlowScene />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
        {['Upload', 'Parse', 'Match', 'Review', 'Submit'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className="text-cyan-400/90">{s}</span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
