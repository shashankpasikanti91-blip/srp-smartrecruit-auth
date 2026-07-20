'use client'

import Image from 'next/image'
import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'

const SHORTLIST = [
  { name: 'Priya S.', role: 'Sr. React Dev', score: 92, status: 'Approved' },
  { name: 'Arjun M.', role: 'Full Stack', score: 86, status: 'Reviewed' },
  { name: 'Neha G.', role: 'Tech Lead', score: 78, status: 'Pending' },
]

export default function ClientSubmissionMock() {
  return (
    <div className="relative w-full h-full min-h-[360px] solutions-scrollytelling-bg" aria-hidden>
      <div className="relative h-full p-4 lg:p-6">
        <div className="marketing-glass rounded-xl p-3 -rotate-2 marketing-float-gentle mb-3 max-w-[200px]">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400">Submission pack</p>
          <p className="text-xs text-white font-semibold mt-1">Acme Tech — React Lead</p>
          <p className="text-[10px] text-slate-500">3 candidates · recruiter reviewed</p>
        </div>

        <div className="space-y-2 ml-4">
          {SHORTLIST.map((c, i) => (
            <div
              key={c.name}
              className={`marketing-glass rounded-lg px-3 py-2 flex items-center gap-3 max-w-[260px] ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
            >
              <ScoreRing score={c.score} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400">{c.role}</p>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${c.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' : c.status === 'Reviewed' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 right-2 lg:right-4 w-[55%] rotate-2 marketing-float shadow-cinematic-glow rounded-xl overflow-hidden border border-white/10">
          <Image
            src="/marketing/recruit-ai/client-shortlist-preview.svg"
            alt=""
            width={400}
            height={260}
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  )
}
