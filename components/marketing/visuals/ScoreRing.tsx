'use client'

import { useReducedMotion } from '@/components/marketing/hooks/useReducedMotion'

type ScoreRingProps = {
  score: number
  size?: number
  label?: string
}

export function ScoreRing({ score, size = 48, label }: ScoreRingProps) {
  const reduced = useReducedMotion()
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 85 ? '#34d399' : score >= 70 ? '#22d3ee' : '#8b5cf6'

  return (
    <div className="flex flex-col items-center gap-1" aria-hidden="true">
      <svg width={size} height={size} className="marketing-score-ring -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          className="progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            strokeDashoffset: reduced ? offset : circumference,
            ['--ring-offset' as string]: `${offset}`,
            transition: reduced ? 'stroke-dashoffset 0.3s' : undefined,
          }}
        />
      </svg>
      <span className="text-xs font-bold text-white">{score}</span>
      {label && <span className="text-[10px] text-slate-500">{label}</span>}
    </div>
  )
}
