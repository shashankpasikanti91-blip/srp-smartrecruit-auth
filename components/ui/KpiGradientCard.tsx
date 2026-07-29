'use client'

import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export type KpiTone = 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7'

export type KpiGradientCardProps = {
  label: string
  value: string | number
  sub?: string
  tone?: KpiTone
  icon?: ReactNode
  trend?: 'up' | 'down' | 'flat'
  trendLabel?: string
  warn?: boolean
  onClick?: () => void
  className?: string
}

/** Enterprise soft-gradient KPI tile — shared by Dashboard + My Performance. */
export function KpiGradientCard({
  label,
  value,
  sub,
  tone = 'g1',
  icon,
  trend,
  trendLabel,
  warn,
  onClick,
  className = '',
}: KpiGradientCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const body = (
    <>
      {icon ? <span className="kpi-card__icon" aria-hidden>{icon}</span> : null}
      <p className="kpi-card__label pr-8">{label}</p>
      <p className="kpi-card__value tabular-nums">{value}</p>
      {trend && (
        <span className={`kpi-card__trend kpi-card__trend--${trend}`}>
          <TrendIcon className="w-3 h-3" />
          {trendLabel ?? (trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Steady')}
        </span>
      )}
      {sub ? <p className="kpi-card__sub">{sub}</p> : null}
    </>
  )

  const cls = `kpi-card kpi-card--gradient kpi-card--${tone} ${warn ? 'ring-2 ring-amber-300' : ''} ${className}`.trim()

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cls} text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
      >
        {body}
      </button>
    )
  }

  return <div className={cls}>{body}</div>
}
