'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import GlowStage from '@/components/marketing/ui/GlowStage'
import { FINAL_CTA } from '@/content/marketing/homepage'

export default function CinematicCTA() {
  return (
    <CinematicSection id="cta" variant="stage" className="py-24 lg:py-32">
      <GlowStage />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-display-lg font-extrabold text-white">{FINAL_CTA.title}</h2>
        <p className="mt-6 text-lg text-slate-400 max-w-xl mx-auto">{FINAL_CTA.subtitle}</p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={FINAL_CTA.primary.href} className="inline-flex items-center gap-2 px-10 py-4 min-h-[44px] rounded-xl bg-[#F97316] text-[#0B1F14] font-bold text-sm hover:bg-[#ea580c]">
            {FINAL_CTA.primary.label} <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link href={FINAL_CTA.secondary.href} className="inline-flex items-center px-10 py-4 min-h-[44px] rounded-xl border border-[#F97316] text-white font-semibold text-sm hover:bg-white/5">
            {FINAL_CTA.secondary.label}
          </Link>
        </div>
        <div className="mt-12 flex justify-center gap-3 opacity-40" aria-hidden>
          {['Upload', 'Match', 'Review'].map((s) => (
            <span key={s} className="px-3 py-1 text-[10px] rounded-full border border-white/20 text-slate-400">{s}</span>
          ))}
        </div>
      </div>
    </CinematicSection>
  )
}
