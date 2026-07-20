'use client'

import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'

export default function MatchExplanationMock() {
  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center solutions-scrollytelling-bg" aria-hidden>
      <div className="relative w-full h-full p-6 space-y-3">
        <div className="marketing-glass rounded-xl p-4 -rotate-1 marketing-float-gentle max-w-[220px]">
          <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2">Match score</p>
          <div className="flex items-center gap-4">
            <ScoreRing score={88} size={72} />
            <div>
              <p className="text-sm font-bold text-white">Priya S.</p>
              <p className="text-xs text-slate-400">Sr. React Developer</p>
            </div>
          </div>
        </div>

        <div className="marketing-glass rounded-xl p-4 rotate-1 ml-auto max-w-[240px] marketing-float" style={{ animationDelay: '0.3s' }}>
          <p className="text-[10px] uppercase tracking-widest text-emerald-400 mb-2">Skills matched</p>
          <div className="flex flex-wrap gap-1.5">
            {['React', 'TypeScript', 'Team lead', 'AWS'].map((s) => (
              <span key={s} className="px-2 py-0.5 text-[10px] rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="marketing-glass rounded-xl p-4 -rotate-2 max-w-[200px] marketing-float-slow" style={{ animationDelay: '0.5s' }}>
          <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-2">Review gaps</p>
          <ul className="text-[11px] text-slate-400 space-y-1">
            <li>· Notice period unverified</li>
            <li>· Cert not on CV</li>
          </ul>
        </div>

        <div className="marketing-glass rounded-xl p-3 rotate-1 ml-8 max-w-[260px]">
          <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-1">Experience</p>
          <p className="text-xs text-slate-300">8 yrs verified · 3 yrs React lead · FinTech domain</p>
        </div>
      </div>
    </div>
  )
}
