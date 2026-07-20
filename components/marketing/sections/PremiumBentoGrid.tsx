'use client'

import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { AGENCY_MODULES, MODULES_SECTION } from '@/content/marketing/homepage'
import { ScoreRing } from '@/components/marketing/visuals/ScoreRing'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type VisualType = (typeof AGENCY_MODULES)[number]['visual']

function ModuleMiniVisual({ type }: { type: VisualType }) {
  if (type === 'ring') {
    return (
      <div className="flex justify-start" aria-hidden>
        <ScoreRing score={88} size={56} />
      </div>
    )
  }
  if (type === 'pipeline') {
    return (
      <div className="space-y-2" aria-hidden>
        <div className="h-1.5 w-full pipeline-beam-animated rounded-full" />
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span>248 parsed</span>
          <span>42 ranked</span>
          <span>12 shortlisted</span>
        </div>
      </div>
    )
  }
  if (type === 'explain') {
    return (
      <div className="space-y-1.5 text-[10px]" aria-hidden>
        <p className="text-emerald-400">React · Team lead · 8 yrs</p>
        <p className="text-amber-400/90">Review notice period</p>
      </div>
    )
  }
  if (type === 'duplicate') {
    return (
      <p className="text-[10px] text-amber-300/90 italic" aria-hidden>&ldquo;Possible duplicate — same email&rdquo;</p>
    )
  }
  if (type === 'submission') {
    return (
      <div className="flex gap-2" aria-hidden>
        {['Priya S.', 'Arjun M.'].map((n) => (
          <span key={n} className="px-2 py-1 rounded-md bg-emerald-500/10 text-[10px] text-emerald-300 border border-emerald-500/20">{n}</span>
        ))}
      </div>
    )
  }
  if (type === 'kanban') {
    return (
      <div className="flex gap-1.5 h-10 items-end" aria-hidden>
        {['Screen', 'Review', 'Submit', 'Placed'].map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded bg-cyan-500/30" style={{ height: `${40 + i * 12}%` }} />
            <span className="text-[8px] text-slate-600">{s}</span>
          </div>
        ))}
      </div>
    )
  }
  if (type === 'chart') {
    return (
      <div className="flex items-end gap-1 h-10" aria-hidden>
        {[35, 55, 45, 70, 50].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-violet-500/35" style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-1 text-[10px] text-slate-500" aria-hidden>
      <p>Recruiter approved shortlist</p>
      <p>Client pack sent · 2:14 PM</p>
    </div>
  )
}

function ModuleHub() {
  return (
    <div className="agency-module-hub" aria-hidden>
      <div className="agency-module-hub-glow" />
      <div className="agency-module-hub-core">
        <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2">Agency command view</p>
        <div className="flex items-center gap-4 mb-3">
          <ScoreRing score={91} size={64} />
          <div>
            <p className="text-sm font-bold text-white">React Lead · Acme Tech</p>
            <p className="text-xs text-slate-400">12 shortlisted · 3 ready to submit</p>
          </div>
        </div>
        <div className="h-1 w-full pipeline-beam-animated rounded-full mb-2" />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Screen</span>
          <span>Review</span>
          <span>Submit</span>
        </div>
      </div>
    </div>
  )
}

const LAYOUT_CLASS: Record<(typeof AGENCY_MODULES)[number]['layout'], string> = {
  feature: 'agency-module-panel agency-module-panel--feature',
  'orbit-tl': 'agency-module-panel agency-module-panel--orbit-tl',
  'orbit-tr': 'agency-module-panel agency-module-panel--orbit-tr',
  'orbit-bl': 'agency-module-panel agency-module-panel--orbit-bl',
  'orbit-br': 'agency-module-panel agency-module-panel--orbit-br',
  rail: 'agency-module-panel agency-module-panel--rail',
}

export default function PremiumBentoGrid() {
  const { ref, isVisible } = useInViewReveal()
  const feature = AGENCY_MODULES.find((m) => m.layout === 'feature')!
  const orbit = AGENCY_MODULES.filter((m) => m.layout.startsWith('orbit'))
  const rail = AGENCY_MODULES.filter((m) => m.layout === 'rail')

  return (
    <CinematicSection id="modules" variant="bleed" className="py-16 lg:py-24">
      <div ref={ref} className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-3">{MODULES_SECTION.eyebrow}</p>
            <h2 className="font-display text-display-lg font-extrabold text-white text-balance">{MODULES_SECTION.title}</h2>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed">{MODULES_SECTION.subtitle}</p>
          </div>
          <Link href="/features" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 shrink-0">
            All capabilities <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Desktop: product map */}
        <div className="hidden lg:block agency-module-map">
          <article id={feature.id} className={`${LAYOUT_CLASS.feature} scroll-mt-24`}>
            <h3 className="font-bold text-white text-lg mb-2">{feature.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4 max-w-md">{feature.description}</p>
            <ModuleMiniVisual type={feature.visual} />
          </article>

          <div className="agency-module-map-center">
            <ModuleHub />
          </div>

          {orbit.map((mod) => (
            <article key={mod.id} id={mod.id} className={`${LAYOUT_CLASS[mod.layout]} scroll-mt-24`}>
              <h3 className="font-semibold text-white text-sm mb-1">{mod.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">{mod.description}</p>
              <ModuleMiniVisual type={mod.visual} />
            </article>
          ))}

          <div className="agency-module-rail">
            {rail.map((mod) => (
              <article key={mod.id} id={mod.id} className="agency-module-panel agency-module-panel--rail-item scroll-mt-24">
                <h3 className="font-semibold text-white text-sm mb-1">{mod.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{mod.description}</p>
                <ModuleMiniVisual type={mod.visual} />
              </article>
            ))}
          </div>
        </div>

        {/* Mobile / tablet: horizontal panels */}
        <div className="lg:hidden space-y-4">
          {AGENCY_MODULES.map((mod) => (
            <article key={mod.id} id={mod.id} className="agency-module-panel agency-module-panel--mobile scroll-mt-24">
              <h3 className="font-semibold text-white text-base mb-1">{mod.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">{mod.description}</p>
              <ModuleMiniVisual type={mod.visual} />
            </article>
          ))}
        </div>
      </div>
    </CinematicSection>
  )
}
