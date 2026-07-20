'use client'

import Image from 'next/image'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'
import { PREVIEW } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function RecruitmentCommandCenter() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="command-center" variant="mid" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-4">{PREVIEW.eyebrow}</p>
          <h2 className="font-display text-display-lg font-extrabold text-white">{PREVIEW.title}</h2>
          <p className="mt-4 text-slate-400">{PREVIEW.subtitle}</p>
        </div>
        <Image
          src={MARKETING_PHOTOS.intelligenceDashboard.src}
          alt={MARKETING_PHOTOS.intelligenceDashboard.alt}
          width={1400}
          height={788}
          className="w-full h-auto rounded-2xl shadow-cinematic-glow object-cover"
        />
      </div>
    </CinematicSection>
  )
}
