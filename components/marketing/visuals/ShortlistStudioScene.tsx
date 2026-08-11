'use client'

import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

const INCOMING_CVS = [
  { name: 'CV_batch_47.pdf', client: 'Acme Tech', delay: '0s' },
  { name: 'Resume_M_Kumar.docx', client: 'Nova Retail', delay: '0.2s' },
  { name: 'Profiles_Q2.zip', client: 'Helix Health', delay: '0.4s' },
]

const RANKED = [
  { name: 'Priya S.', role: 'Sr. React Dev', score: 92 },
  { name: 'Arjun M.', role: 'Full Stack', score: 86 },
  { name: 'Neha G.', role: 'Tech Lead', score: 78 },
]

const KANBAN = [
  { stage: 'Screening', count: 48, color: 'bg-[#F97316]/40' },
  { stage: 'Review', count: 12, color: 'bg-[#166534]/60' },
  { stage: 'Shortlist', count: 5, color: 'bg-emerald-500/30' },
]

export default function ShortlistStudioScene() {
  const reduced = useReducedMotion()
  const use3d = !reduced

  return (
    <div
      className={`relative w-full shortlist-studio-bg rounded-3xl overflow-hidden shadow-cinematic-glow ${use3d ? 'marketing-scene-3d min-h-[380px] sm:min-h-[440px] lg:min-h-[500px] xl:min-h-[540px]' : 'min-h-[360px] p-4'}`}
      aria-hidden="true"
    >
      <div className={use3d ? 'marketing-scene-inner relative h-[380px] sm:h-[440px] lg:h-[500px] xl:h-[540px]' : 'relative space-y-4'}>
        <div className={`${use3d ? 'absolute left-3 lg:left-6 top-8 lg:top-10 space-y-2.5' : 'space-y-2'}`}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 px-1">Incoming CVs</p>
          {INCOMING_CVS.map((cv) => (
            <div
              key={cv.name}
              className={`marketing-glass rounded-lg px-3 py-2.5 w-40 lg:w-48 -rotate-2 ${use3d ? 'marketing-float' : ''}`}
              style={use3d ? { animationDelay: cv.delay } : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-10 rounded bg-gradient-to-b from-slate-600/80 to-slate-800/80 border border-white/10 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-200 truncate">{cv.name}</p>
                  <p className="text-[10px] text-[#F97316]/80">{cv.client}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`${use3d ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-52 lg:w-60 xl:w-64' : 'mx-auto max-w-sm'}`}>
          <div className={`marketing-glass rounded-xl p-4 rotate-1 ${use3d ? 'marketing-float-slow' : ''}`}>
            <p className="text-[10px] uppercase tracking-widest text-[#F97316] mb-2">Shortlist studio</p>
            <div className="h-1.5 w-full pipeline-beam-animated rounded-full mb-3" />
            <div className="flex gap-2 mb-3">
              {KANBAN.map((col) => (
                <div key={col.stage} className="flex-1 rounded-lg bg-white/[0.03] p-2 text-center">
                  <div className={`h-10 rounded ${col.color} mb-1`} />
                  <p className="text-[9px] text-slate-400">{col.stage}</p>
                  <p className="text-xs font-bold text-white">{col.count}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2">
              <p className="text-[10px] text-emerald-400 font-semibold">AI explanation</p>
              <p className="text-[10px] text-slate-400 leading-snug mt-0.5">Strong React + team lead fit. Verify notice period.</p>
            </div>
          </div>
        </div>

        <div className={`${use3d ? 'absolute right-3 lg:right-6 top-6 lg:top-8 space-y-2.5' : 'space-y-2'}`}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 text-right px-1">Ranked candidates</p>
          {RANKED.map((c, i) => (
            <div
              key={c.name}
              className={`marketing-glass rounded-xl px-3 py-2.5 flex items-center gap-3 w-44 lg:w-52 rotate-1 ${use3d ? 'marketing-float' : ''}`}
              style={use3d ? { animationDelay: `${0.15 + i * 0.12}s` } : undefined}
            >
              <ScoreRing score={c.score} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{c.role}</p>
              </div>
            </div>
          ))}
          <div className={`marketing-glass rounded-lg px-3 py-2.5 w-44 lg:w-52 ml-auto -rotate-1 border border-emerald-500/25 ${use3d ? 'marketing-float-gentle' : ''}`} style={use3d ? { animationDelay: '0.6s' } : undefined}>
            <p className="text-[10px] text-emerald-400 font-semibold">Client pack ready</p>
            <p className="text-[11px] text-slate-300 mt-0.5">3 profiles · scored · reviewed</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2 text-[10px] text-slate-500 pb-4 pt-1">
        {['Incoming CVs', 'Shortlist Studio', 'Ranked Candidates', 'Client Pack'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className="text-[#F97316] font-medium">{s}</span>
            {i < arr.length - 1 && <span aria-hidden>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
