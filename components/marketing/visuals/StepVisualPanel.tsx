'use client'

import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'
import Image from 'next/image'

type StepVisualPanelProps = {
  stepId: string
  description: string
}

export default function StepVisualPanel({ stepId, description }: StepVisualPanelProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-marketing-navy-mid/80 p-6 lg:p-8">
      <div className="absolute inset-0 glow-orbit-bg opacity-50" aria-hidden />
      <div className="relative z-10">
        <p className="text-sm text-slate-400 mb-6 max-w-md leading-relaxed">{description}</p>
        {stepId === 'upload' && (
          <div className="flex gap-3 flex-wrap" aria-hidden>
            {['CV_batch_01.pdf', 'Resume_42.docx', 'Profiles.zip'].map((f) => (
              <div key={f} className="px-4 py-3 rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 text-xs text-[#F97316] marketing-float-gentle">{f}</div>
            ))}
          </div>
        )}
        {stepId === 'parse' && (
          <div className="space-y-2" aria-hidden>
            {['React', 'Node.js', '8 yrs exp', 'AWS'].map((s) => (
              <span key={s} className="inline-block mr-2 px-3 py-1 rounded-full text-xs bg-[#166534]/40 text-[#F97316] border border-[#F97316]/30">{s}</span>
            ))}
          </div>
        )}
        {stepId === 'match' && <ScoreRing score={88} size={120} />}
        {stepId === 'explain' && (
          <div className="marketing-glass rounded-xl p-4 max-w-sm text-xs text-slate-300 space-y-2" aria-hidden>
            <p className="text-emerald-400 font-semibold">Strengths</p>
            <p>Matches required React + team lead experience</p>
            <p className="text-amber-400 font-semibold mt-2">Review</p>
            <p>Verify notice period with recruiter</p>
          </div>
        )}
        {stepId === 'review' && (
          <div className="flex gap-3" aria-hidden>
            <span className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 text-sm border border-emerald-500/30">Approve</span>
            <span className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm border border-white/10">Hold</span>
          </div>
        )}
        {stepId === 'submit' && (
          <Image src="/marketing/recruit-ai/client-shortlist-preview.svg" alt="Client-ready shortlist submission preview" width={400} height={260} className="rounded-xl max-w-full h-auto" />
        )}
      </div>
    </div>
  )
}
