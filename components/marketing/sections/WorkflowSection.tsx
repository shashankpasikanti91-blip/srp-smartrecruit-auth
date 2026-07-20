'use client'

import { WORKFLOW, HOMEPAGE_ANCHORS } from '@/content/marketing/homepage'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'
import PipelineJourney from '@/components/marketing/visuals/PipelineJourney'

export default function WorkflowSection() {
  const { ref, isVisible } = useInViewReveal()

  return (
    <section
      id={HOMEPAGE_ANCHORS.workflow}
      ref={ref}
      className={`py-24 px-4 sm:px-6 lg:px-8 marketing-grid-bg marketing-reveal ${isVisible ? 'is-visible' : ''}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">
            {WORKFLOW.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            {WORKFLOW.title}
          </h2>
          <p className="mt-4 text-slate-400 text-lg">{WORKFLOW.subtitle}</p>
        </div>
        <PipelineJourney />
      </div>
    </section>
  )
}
