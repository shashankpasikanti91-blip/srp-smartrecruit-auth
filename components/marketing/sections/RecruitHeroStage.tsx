'use client'

import ShortlistStudioScene from '@/components/marketing/visuals/ShortlistStudioScene'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import GlowStage from '@/components/marketing/ui/GlowStage'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { HERO } from '@/content/marketing/homepage'

export default function RecruitHeroStage() {
  return (
    <CinematicSection variant="stage" minHeight="100vh" className="flex flex-col justify-center pt-16">
      <GlowStage />
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-10 lg:py-16 grid lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] gap-8 xl:gap-14 items-center min-h-[calc(100vh-4rem)]">
        <div className="min-w-0 lg:pr-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90 mb-5 lg:mb-6">{HERO.eyebrow}</p>
          <h1 className="hero-title font-display font-extrabold text-white">
            <span className="hidden lg:block">
              {HERO.titleLines.desktop.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </span>
            <span className="lg:hidden">
              {HERO.titleLines.mobile.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </span>
          </h1>
          <p className="mt-5 lg:mt-6 text-base lg:text-lg text-slate-400 leading-relaxed max-w-xl xl:max-w-2xl">{HERO.subtitle}</p>
          <div className="mt-8 lg:mt-10 flex flex-col sm:flex-row gap-3">
            <Link href={HERO.ctaPrimary.href} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm btn-glow">
              {HERO.ctaPrimary.label} <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href={HERO.ctaSecondary.href} className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5">
              {HERO.ctaSecondary.label}
            </Link>
          </div>
          <ul className="mt-7 lg:mt-8 flex flex-wrap gap-2" aria-label="Key capabilities">
            {HERO.trustChips.map((chip) => (
              <li key={chip} className="px-3 py-1 text-xs text-slate-400 border border-white/10 rounded-full">{chip}</li>
            ))}
          </ul>
        </div>
        <div className="w-full min-w-0 lg:pl-2">
          <ShortlistStudioScene />
        </div>
      </div>
      <div className="relative z-10 flex justify-center pb-8 scroll-cue" aria-hidden>
        <ChevronDown className="w-6 h-6 text-slate-500" />
      </div>
    </CinematicSection>
  )
}
