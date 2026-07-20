'use client'

import { useState } from 'react'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { STICKY_STORY } from '@/content/marketing/homepage'
import StepVisualPanel from '@/components/marketing/visuals/StepVisualPanel'

export default function StickyProductStory() {
  const [activeStep, setActiveStep] = useState(0)
  const step = STICKY_STORY.steps[activeStep]

  return (
    <CinematicSection id="product-story" variant="stage" className="py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 lg:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-3">{STICKY_STORY.eyebrow}</p>
          <h2 className="font-display text-display-lg font-extrabold text-white max-w-2xl">{STICKY_STORY.title}</h2>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-8 lg:gap-12 items-start">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:overflow-visible" aria-label="Product workflow steps">
            {STICKY_STORY.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(i)}
                className={`shrink-0 lg:shrink lg:w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeStep === i
                    ? 'bg-gradient-to-r from-cyan-500/15 to-violet-600/15 text-white border border-cyan-500/30'
                    : 'text-slate-500 border border-transparent hover:text-slate-300 hover:border-white/10'
                }`}
                aria-current={activeStep === i ? 'step' : undefined}
              >
                <span className="text-[10px] text-slate-600 block mb-0.5">0{i + 1}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div key={step.id} className="min-h-[260px] marketing-reveal is-visible">
            <StepVisualPanel stepId={step.id} description={step.description} />
          </div>
        </div>
      </div>
    </CinematicSection>
  )
}
