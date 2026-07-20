'use client'

import Image from 'next/image'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'
import { AGENCY_OPS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

export default function AgencyOperationsRoom() {
  const { ref, isVisible } = useInViewReveal()
  const reduced = useReducedMotion()

  return (
    <CinematicSection id="agency-ops" variant="mid" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90 mb-4">{AGENCY_OPS.eyebrow}</p>
            <h2 className="font-display text-display-lg font-extrabold text-white">{AGENCY_OPS.title}</h2>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">{AGENCY_OPS.subtitle}</p>
            <div className="mt-10 space-y-3">
              {AGENCY_OPS.alerts.map((alert, i) => (
                <div
                  key={alert}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.02] ${!reduced ? 'marketing-float-gentle' : ''}`}
                  style={!reduced ? { animationDelay: `${i * 0.3}s` } : undefined}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-hidden />
                  <span className="text-sm text-slate-300">{alert}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <Image
              src={MARKETING_PHOTOS.highVolumeFloor.src}
              alt={MARKETING_PHOTOS.highVolumeFloor.alt}
              width={1200}
              height={675}
              className="w-full h-auto rounded-2xl object-cover shadow-cinematic-glow"
            />
          </div>
        </div>
      </div>
    </CinematicSection>
  )
}
