import { type ReactNode } from 'react'

type CinematicSectionProps = {
  id?: string
  children: ReactNode
  className?: string
  variant?: 'stage' | 'bleed' | 'mid' | 'band'
  minHeight?: string
}

const VARIANTS = {
  stage: 'cinematic-stage',
  bleed: 'bg-marketing-black',
  mid: 'bg-marketing-navy-mid',
  band: 'bg-marketing-navy',
}

export default function CinematicSection({
  id,
  children,
  className = '',
  variant = 'stage',
  minHeight,
}: CinematicSectionProps) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden ${VARIANTS[variant]} ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {children}
    </section>
  )
}
