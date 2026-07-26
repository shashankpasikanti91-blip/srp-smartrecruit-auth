'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

const COLORS = {
  primary: '#2563EB',
  secondary: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: '#94A3B8',
}

type TrendPoint = { d: string; n: number }

function shortDay(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(5, 10)
  }
}

export function TrendAreaChart({
  data,
  color = COLORS.primary,
  emptyLabel = 'No trend data yet',
}: {
  data: TrendPoint[]
  color?: string
  emptyLabel?: string
}) {
  if (!data.length) {
    return <p className="text-sm font-medium text-slate-500 py-10 text-center">{emptyLabel}</p>
  }
  const chartData = data.slice(-14).map(p => ({ label: shortDay(p.d), value: p.n }))
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.08)' }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#grad-${color.replace('#', '')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const FUNNEL_COLORS = ['#2563EB', '#6366F1', '#8B5CF6', '#F59E0B', '#10B981', '#059669']

export function HiringFunnelChart({
  stages,
  onStageClick,
}: {
  stages: { key: string; label: string; count: number }[]
  onStageClick?: (key: string) => void
}) {
  const max = Math.max(...stages.map(s => s.count), 1)
  const chartData = stages.map(s => ({ ...s, value: s.count }))

  if (stages.every(s => s.count === 0)) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-sm font-semibold text-slate-700">No pipeline data yet</p>
        <p className="text-xs text-slate-500">Screen candidates or move them through stages to populate the funnel.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => [`${v} candidates`, 'Count']}
              contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18} cursor={onStageClick ? 'pointer' : 'default'}
              onClick={(d) => {
                const key = (d as { key?: string })?.key
                if (key && onStageClick) onStageClick(key)
              }}>
              {chartData.map((entry, i) => (
                <Cell key={entry.key} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} fillOpacity={0.55 + (entry.count / max) * 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stages.map((s, i) => {
          const pct = max > 0 ? Math.round((s.count / max) * 100) : 0
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStageClick?.(s.key)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate">{s.label}</p>
              <p className="text-lg font-extrabold text-slate-900 leading-tight" style={{ color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>{s.count}</p>
              <p className="text-[10px] font-semibold text-slate-400">{pct}% of peak</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { COLORS as CHART_COLORS }
