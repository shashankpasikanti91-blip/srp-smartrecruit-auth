'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useScrollProgress } from '@/components/marketing/hooks/useScrollProgress'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

type ScrollReframeVisualProps = {
  src: string
  alt: string
  className?: string
}

export default function ScrollReframeVisual({ src, alt, className = '' }: ScrollReframeVisualProps) {
  const ref = useRef<HTMLDivElement>(null)
  const progress = useScrollProgress(ref)
  const reduced = useReducedMotion()

  const scale = reduced ? 1 : 1 - progress * 0.15
  const radius = reduced ? 16 : 8 + progress * 24
  const y = reduced ? 0 : progress * -40

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className="scroll-reframe-target overflow-hidden shadow-cinematic-glow"
        style={{
          transform: `scale(${scale}) translateY(${y}px)`,
          borderRadius: `${radius}px`,
        }}
      >
        <Image src={src} alt={alt} width={1200} height={700} className="w-full h-auto" priority={false} />
      </div>
    </div>
  )
}
