'use client'

import { useEffect, useState, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion'

export type SolutionsScrollState = {
  progress: number
  visualWidthPct: number
  visualHeightPx: number
  visualOffsetPct: number
  borderRadiusPx: number
  textOpacity: number
  textY: number
  isFramed: boolean
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

const FRAMED_HEIGHT = 480
const FRAMED_WIDTH_PCT = 48
const HOLD_END = 0.05
const TRANSFORM_END = 0.5

function deriveState(progress: number, imageSide: 'left' | 'right', vh: number): SolutionsScrollState {
  const rawPhase = clamp01((progress - HOLD_END) / (TRANSFORM_END - HOLD_END))
  const phase = easeOutCubic(rawPhase)

  const visualWidthPct = lerp(100, FRAMED_WIDTH_PCT, phase)
  const visualHeightPx = lerp(vh * 0.75, FRAMED_HEIGHT, phase)
  const visualOffsetPct = lerp(50, imageSide === 'left' ? 24 : 76, phase)
  const borderRadiusPx = lerp(0, 16, phase)

  return {
    progress,
    visualWidthPct,
    visualHeightPx,
    visualOffsetPct,
    borderRadiusPx,
    textOpacity: phase,
    textY: lerp(24, 0, phase),
    isFramed: phase > 0.85,
  }
}

function endState(imageSide: 'left' | 'right'): SolutionsScrollState {
  return {
    progress: 1,
    visualWidthPct: FRAMED_WIDTH_PCT,
    visualHeightPx: FRAMED_HEIGHT,
    visualOffsetPct: imageSide === 'left' ? 24 : 76,
    borderRadiusPx: 16,
    textOpacity: 1,
    textY: 0,
    isFramed: true,
  }
}

const INITIAL_STATE: SolutionsScrollState = {
  progress: 0,
  visualWidthPct: 100,
  visualHeightPx: 560,
  visualOffsetPct: 50,
  borderRadiusPx: 0,
  textOpacity: 0,
  textY: 24,
  isFramed: false,
}

/** Scroll progress for solutions page editorial blocks (desktop sticky). */
export function useSolutionsScrollProgress(
  ref: RefObject<HTMLElement | null>,
  imageSide: 'left' | 'right',
  enabled = true,
): SolutionsScrollState {
  const reduced = useReducedMotion()
  const [state, setState] = useState<SolutionsScrollState>(INITIAL_STATE)

  useEffect(() => {
    if (reduced || !enabled) return

    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const scrollable = el.offsetHeight - vh
      if (scrollable <= 0) {
        setState(endState(imageSide))
        return
      }
      const scrolled = clamp01((vh * 0.3 - rect.top) / scrollable)
      setState(deriveState(scrolled, imageSide, vh))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref, imageSide, reduced, enabled])

  if (reduced || !enabled) return endState(imageSide)
  return state
}
