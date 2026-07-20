'use client'

import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'
import AIRecruitmentOrbit from '@/components/marketing/visuals/AIRecruitmentOrbit'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

const INCOMING = [
  { name: 'Resume_A.pdf', delay: '0s' },
  { name: 'CV_Bulk_12.docx', delay: '0.3s' },
]

const RANKED = [
  { name: 'Priya S.', role: 'Sr. React Dev', score: 92 },
  { name: 'Arjun M.', role: 'Full Stack', score: 86 },
  { name: 'Neha G.', role: 'Tech Lead', score: 78 },
]

const MINI_CARDS = [
  { label: 'Skills gap', value: 'TypeScript ✓' },
  { label: 'Experience', value: '6 yrs verified' },
  { label: 'Duplicate', value: 'None flagged' },
]

export default function CandidateFlowScene() {
  const reduced = useReducedMotion()
  const use3d = !reduced

  return (
    <div
      className={`relative w-full max-w-lg mx-auto ${use3d ? 'marketing-scene-3d min-h-[420px]' : 'min-h-[360px]'}`}
      aria-hidden="true"
    >
      <div className={use3d ? 'marketing-scene-inner relative h-full' : 'relative space-y-4'}>
        {/* Incoming resumes */}
        <div className={`${use3d ? 'absolute left-0 top-8 space-y-3' : 'space-y-2'}`}>
          {INCOMING.map((r) => (
            <div
              key={r.name}
              className={`marketing-glass rounded-lg px-3 py-2 w-36 ${use3d ? 'marketing-float' : ''}`}
              style={use3d ? { animationDelay: r.delay } : undefined}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-10 rounded bg-slate-700/80 border border-white/10" />
                <div>
                  <p className="text-[10px] font-medium text-slate-300 truncate">{r.name}</p>
                  <p className="text-[9px] text-cyan-400/80">Uploading…</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI core */}
        <div className={use3d ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'flex justify-center py-4'}>
          <AIRecruitmentOrbit />
        </div>

        {/* Ranked output */}
        <div className={`${use3d ? 'absolute right-0 top-12 space-y-2.5' : 'space-y-2'}`}>
          {RANKED.map((c, i) => (
            <div
              key={c.name}
              className={`marketing-glass rounded-xl px-3 py-2.5 flex items-center gap-3 w-44 ${use3d ? 'marketing-float' : ''}`}
              style={use3d ? { animationDelay: `${0.2 + i * 0.15}s` } : undefined}
            >
              <ScoreRing score={c.score} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{c.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mini dashboard cards */}
        <div className={`${use3d ? 'absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2' : 'flex flex-wrap justify-center gap-2 pt-2'}`}>
          {MINI_CARDS.map((card) => (
            <div key={card.label} className="marketing-glass rounded-lg px-2.5 py-1.5 text-center min-w-[90px]">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">{card.label}</p>
              <p className="text-[10px] font-medium text-emerald-300/90">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage strip */}
      <div className="mt-6 flex flex-wrap justify-center gap-1.5 text-[9px] text-slate-500">
        {['Uploaded', 'Parsed', 'Matched', 'Shortlisted', 'Submitted'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="text-cyan-400/90 font-medium">{s}</span>
            {i < arr.length - 1 && <span aria-hidden>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
