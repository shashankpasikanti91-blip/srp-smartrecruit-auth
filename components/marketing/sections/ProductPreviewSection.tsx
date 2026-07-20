'use client'

import { PREVIEW, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import ProductPreviewDashboard from '@/components/marketing/visuals/ProductPreviewDashboard'

export default function ProductPreviewSection() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.preview}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 marketing-grid-bg marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {PREVIEW.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            {PREVIEW.title}
          </h2>
          <p className="mt-4 text-slate-400">{PREVIEW.subtitle}</p>
        </div>
        <ProductPreviewDashboard />
      </div>
    </section>
  )
}
