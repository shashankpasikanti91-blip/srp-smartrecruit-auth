'use client'

import { type ReactNode } from 'react'
import { useInViewReveal } from '@/components/marketing/hooks/useInViewReveal'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}

export default function ScrollReveal({ children, className = '', as: Tag = 'div' }: ScrollRevealProps) {
  const { ref, isVisible } = useInViewReveal<HTMLDivElement>()
  return (
    <Tag ref={ref} className={`marketing-reveal ${isVisible ? 'is-visible' : ''} ${className}`}>
      {children}
    </Tag>
  )
}
