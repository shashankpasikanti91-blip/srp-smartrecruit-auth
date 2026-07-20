'use client'

import Image from 'next/image'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'
import { HUMAN_REVIEW } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

export default function HumanReviewPanel() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <CinematicSection id="human-review" variant="stage" className="py-24 lg:py-32">
      <div ref={ref} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 marketing-reveal ${isVisible ? 'is-visible' : ''}`}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-3">{HUMAN_REVIEW.eyebrow}</p>
          <h2 className="font-display text-display-lg font-extrabold text-white">{HUMAN_REVIEW.title}</h2>
          <p className="mt-4 text-slate-400 text-lg">{HUMAN_REVIEW.subtitle}</p>
        </div>
        <Image
          src={MARKETING_PHOTOS.humanReview.src}
          alt={MARKETING_PHOTOS.humanReview.alt}
          width={1200}
          height={675}
          className="w-full h-auto rounded-2xl shadow-cinematic-glow object-cover"
        />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {HUMAN_REVIEW.points.map((p) => (
            <div key={p.title} className="border-l-2 border-violet-500/40 pl-5">
              <h3 className="font-semibold text-white text-sm">{p.title}</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </CinematicSection>
  )
}
