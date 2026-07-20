'use client'

import CinematicSection from '@/components/marketing/ui/CinematicSection'
import ScrollReframeVisual from '@/components/marketing/ui/ScrollReframeVisual'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'
import { SCROLL_STORY } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function FullBleedImageTransition() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="scroll-story" variant="bleed" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1">
            <ScrollReframeVisual
              src={MARKETING_PHOTOS.cvScreening.src}
              alt={MARKETING_PHOTOS.cvScreening.alt}
            />
          </div>
          <div className="order-1 lg:order-2 max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-4">{SCROLL_STORY.eyebrow}</p>
            <h2 className="font-display text-display-lg font-extrabold text-white">{SCROLL_STORY.title}</h2>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">{SCROLL_STORY.subtitle}</p>
            <ul className="mt-8 space-y-4">
              {SCROLL_STORY.points.map((p) => (
                <li key={p} className="text-sm text-slate-300 pl-4 border-l-2 border-cyan-500/40">{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </CinematicSection>
  )
}
