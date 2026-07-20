'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { useSolutionsScrollProgress } from '@/components/marketing/hooks/useSolutionsScrollProgress'

type SolutionsScrollBlockProps = {
  id?: string
  heading: string
  body: string
  action: { label: string; href: string }
  visual: ReactNode
  imageSide: 'left' | 'right'
}

export default function SolutionsScrollBlock({
  id,
  heading,
  body,
  action,
  visual,
  imageSide,
}: SolutionsScrollBlockProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const {
    visualWidthPct,
    visualHeightPx,
    visualOffsetPct,
    borderRadiusPx,
    textOpacity,
    textY,
    isFramed,
    progress,
  } = useSolutionsScrollProgress(sectionRef, imageSide)

  const textOnLeft = imageSide === 'right'

  return (
    <>
      {/* Desktop: sticky scrollytelling */}
      <section
        id={id}
        ref={sectionRef}
        className="solutions-scrollytelling hidden lg:block"
        aria-labelledby={id ? `${id}-heading` : undefined}
      >
        <div className="solutions-editorial-panel">
          <div className="solutions-scrolly-stage">
            <div
              className="solutions-image-reframe"
              style={{
                left: `${visualOffsetPct}%`,
                width: `${visualWidthPct}%`,
                height: `${visualHeightPx}px`,
                borderRadius: `${borderRadiusPx}px`,
                maxWidth: progress < 0.25 ? '1180px' : undefined,
                minWidth: isFramed ? '420px' : undefined,
              }}
            >
              <div className="solutions-image-reframe-inner">{visual}</div>
            </div>

            <div
              className={`solutions-text-panel ${textOnLeft ? 'solutions-text-panel--left' : 'solutions-text-panel--right'}`}
              style={{
                opacity: textOpacity,
                transform: `translateY(calc(-50% + ${textY}px))`,
                pointerEvents: textOpacity > 0.5 ? 'auto' : 'none',
              }}
            >
              <h2
                id={id ? `${id}-heading` : undefined}
                className="font-display text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight"
              >
                {heading}
              </h2>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed">{body}</p>
              <Link href={action.href} className="solutions-action-link mt-8 inline-block">
                {action.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile / tablet: static stack */}
      <section
        id={id ? `${id}-mobile` : undefined}
        className="lg:hidden py-12 md:py-16 px-4 sm:px-6"
        aria-labelledby={id ? `${id}-heading-mobile` : undefined}
      >
        <div className="max-w-2xl mx-auto">
          <div className="solutions-mobile-visual mb-8 rounded-2xl overflow-hidden">{visual}</div>
          <h2
            id={id ? `${id}-heading-mobile` : undefined}
            className="font-display text-3xl font-extrabold text-white leading-tight"
          >
            {heading}
          </h2>
          <p className="mt-5 text-lg text-slate-400 leading-relaxed">{body}</p>
          <Link href={action.href} className="solutions-action-link mt-6 inline-block">
            {action.label}
          </Link>
        </div>
      </section>
    </>
  )
}
