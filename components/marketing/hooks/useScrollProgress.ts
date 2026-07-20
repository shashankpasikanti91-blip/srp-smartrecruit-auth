'use client'

import { useEffect, useState, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion'

/** Returns 0–1 scroll progress of element through viewport. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height + vh
      const scrolled = vh - rect.top
      setProgress(Math.min(1, Math.max(0, scrolled / total)))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref, reduced])

  return reduced ? 0.5 : progress
}
