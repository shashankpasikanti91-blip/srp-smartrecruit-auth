'use client'

import { useEffect, useState, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion'

/** Active step index from scroll position inside a tall container. */
export function useStickyStory(
  containerRef: RefObject<HTMLElement | null>,
  stepCount: number,
) {
  const [activeStep, setActiveStep] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced || stepCount < 1) return
    const el = containerRef.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const scrollable = el.offsetHeight - window.innerHeight
      if (scrollable <= 0) return
      const scrolled = Math.min(scrollable, Math.max(0, -rect.top))
      const idx = Math.min(stepCount - 1, Math.floor((scrolled / scrollable) * stepCount))
      setActiveStep(idx)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [containerRef, stepCount, reduced])

  return reduced ? 0 : activeStep
}
