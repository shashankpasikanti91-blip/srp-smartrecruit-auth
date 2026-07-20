'use client'

import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

const CANDIDATES = [
  { rank: 1, name: 'Ananya Singh', job: 'Sr. React Developer', score: 92, fit: 'Strong', stage: 'Shortlisted' },
  { rank: 2, name: 'Priya Sharma', job: 'Sr. React Developer', score: 86, fit: 'Good', stage: 'Screening' },
  { rank: 3, name: 'Rahul Kumar', job: 'BDE — Mumbai', score: 78, fit: 'Review', stage: 'Applied' },
]

const PIPELINE = [
  { stage: 'Applied', count: 24 },
  { stage: 'Screening', count: 12 },
  { stage: 'Interview', count: 5 },
  { stage: 'Offer', count: 2 },
]

export default function ProductPreviewDashboard() {
  const { ref, isVisible } = useInViewReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`marketing-reveal ${isVisible ? 'is-visible' : ''} marketing-glass rounded-2xl overflow-hidden border border-white/10 shadow-marketing-card`}
      role="img"
      aria-label="Illustrative product dashboard mockup showing candidate rankings and pipeline stages"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-marketing-navy-mid/80">
        <div className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-xs text-slate-500 ml-2">SRP Recruit AI — Workspace Preview (mockup)</span>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ranking table */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-white">Candidate ranking</h3>
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/5 text-slate-400">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Candidate</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Job</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {CANDIDATES.map((c) => (
                  <tr key={c.name} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-slate-500">{c.rank}</td>
                    <td className="px-3 py-2.5 text-white font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">{c.job}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-bold ${c.score >= 85 ? 'text-emerald-400' : c.score >= 75 ? 'text-cyan-400' : 'text-violet-400'}`}>
                        {c.score}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[10px]">
                        {c.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 p-3 bg-marketing-navy-mid/50">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Fit explanation</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Strong match on React, TypeScript, and recent project leadership. Review notice period with client.
            </p>
          </div>
          <div className="rounded-xl border border-white/5 p-3 bg-marketing-navy-mid/50">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Pipeline</h4>
            <ul className="space-y-1.5">
              {PIPELINE.map((p) => (
                <li key={p.stage} className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{p.stage}</span>
                  <span className="text-white font-medium">{p.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] text-amber-200/90 font-medium">Duplicate check</p>
            <p className="text-[11px] text-slate-400 mt-1">No duplicate profile in this workspace.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
