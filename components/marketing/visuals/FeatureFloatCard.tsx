'use client'

import Image from 'next/image'
import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

type FeatureFloatCardProps = {
  visual?: string
  visualAlt?: string
  accent?: 'cyan' | 'violet' | 'emerald'
  children?: React.ReactNode
}

const ACCENT_BORDER = {
  cyan: 'border-cyan-500/25 hover:border-cyan-500/40',
  violet: 'border-violet-500/25 hover:border-violet-500/40',
  emerald: 'border-emerald-500/25 hover:border-emerald-500/40',
}

export default function FeatureFloatCard({
  visual,
  visualAlt,
  accent = 'cyan',
  children,
}: FeatureFloatCardProps) {
  const reduced = useReducedMotion()

  return (
    <div
      className={`relative rounded-2xl marketing-glass border ${ACCENT_BORDER[accent]} overflow-hidden transition-all duration-300 marketing-card-lift h-full flex flex-col`}
    >
      {visual && visualAlt && (
        <div className={`relative p-4 pb-0 ${reduced ? '' : 'marketing-float-gentle'}`}>
          <Image
            src={visual}
            alt={visualAlt}
            width={480}
            height={280}
            className="w-full h-auto rounded-xl"
          />
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col">{children}</div>
    </div>
  )
}
