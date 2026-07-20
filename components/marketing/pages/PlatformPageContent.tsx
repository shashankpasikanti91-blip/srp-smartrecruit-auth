'use client'

import { PLATFORM_PAGE } from '@/content/marketing/platform'
import { INNER_PAGE_CTA } from '@/content/marketing/cta'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import CTABlock from '@/components/marketing/ui/CTABlock'

export default function PlatformPageContent() {
  const { hero, zones } = PLATFORM_PAGE

  return (
    <>
      <EditorialPageHero eyebrow={hero.eyebrow} title={hero.title} subtitle={hero.subtitle} />

      {zones.map((zone, i) => (
        <CinematicSection key={zone.id} id={zone.id} variant={i % 2 === 0 ? 'mid' : 'bleed'} className="py-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="text-[11px] font-mono text-cyan-400/70 uppercase">{zone.id}</span>
            <h2 className="font-display text-3xl font-bold text-white mt-2 mb-4">{zone.title}</h2>
            <p className="text-slate-400 max-w-2xl leading-relaxed mb-6">{zone.description}</p>
            <div className="flex flex-wrap gap-2">
              {zone.chips.map((chip) => (
                <span key={chip} className="px-3 py-1 rounded-full text-xs border border-white/10 text-slate-400">{chip}</span>
              ))}
            </div>
          </div>
        </CinematicSection>
      ))}

      <CTABlock
        title={INNER_PAGE_CTA.title}
        subtitle={INNER_PAGE_CTA.subtitle}
        primary={INNER_PAGE_CTA.primary}
        secondary={INNER_PAGE_CTA.secondary}
      />
    </>
  )
}
