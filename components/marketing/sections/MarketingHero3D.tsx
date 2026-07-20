import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { HERO } from '@/content/marketing/homepage'
import CandidateFlowScene from '@/components/marketing/visuals/CandidateFlowScene'

export default function MarketingHero3D() {
  return (
    <section className="relative marketing-grid-bg min-h-[90vh] flex items-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="text-left max-w-xl">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full marketing-glass text-xs font-medium text-cyan-300/90 mb-6">
            {HERO.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white leading-[1.1] tracking-tight">
            {HERO.title}
          </h1>
          <p className="mt-6 text-lg text-slate-400 leading-relaxed">
            {HERO.subtitle}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={HERO.ctaPrimary.href}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm transition-all btn-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-navy"
            >
              {HERO.ctaPrimary.label}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link
              href={HERO.ctaSecondary.href}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl marketing-glass text-white font-semibold text-sm hover:border-cyan-500/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {HERO.ctaSecondary.label}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Key capabilities">
            {HERO.trustChips.map((chip) => (
              <li
                key={chip}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:pl-4">
          <CandidateFlowScene />
        </div>
      </div>
    </section>
  )
}
