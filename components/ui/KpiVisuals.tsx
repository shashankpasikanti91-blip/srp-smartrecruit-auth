'use client'

/** Power BI–style KPI / report visuals — pure SVG, no chart library. */

export type KpiItem = {
  label: string
  value: string | number
  /** 0–100 for spark / ring fill */
  pct?: number
  /** sparkline series (relative heights) */
  series?: number[]
  tone?: 'indigo' | 'slate' | 'amber' | 'violet' | 'emerald' | 'green' | 'sky'
}

const TONES: Record<NonNullable<KpiItem['tone']>, { bg: string; border: string; text: string; stroke: string; fill: string }> = {
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800',  stroke: '#4f46e5', fill: 'rgba(79,70,229,0.18)' },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-800',   stroke: '#64748b', fill: 'rgba(100,116,139,0.18)' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',   stroke: '#d97706', fill: 'rgba(217,119,6,0.18)' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-800',  stroke: '#7c3aed', fill: 'rgba(124,58,237,0.18)' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', stroke: '#059669', fill: 'rgba(5,150,105,0.18)' },
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-800',   stroke: '#16a34a', fill: 'rgba(22,163,74,0.18)' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-800',     stroke: '#0284c7', fill: 'rgba(2,132,199,0.18)' },
}

const CHART_PALETTE = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#e11d48', '#7c3aed', '#64748b', '#14b8a6']

function SparkWave({ series, stroke, fill }: { series: number[]; stroke: string; fill: string }) {
  const w = 72
  const h = 28
  const max = Math.max(...series, 1)
  const pts = series.map((v, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  })
  const line = pts.join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polygon points={area} fill={fill} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MiniDonut({ pct, stroke }: { pct: number; stroke: string }) {
  const r = 10
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  const dash = (p / 100) * c
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
      <circle
        cx="14" cy="14" r={r} fill="none" stroke={stroke} strokeWidth="3.5"
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
      />
    </svg>
  )
}

export function KpiVisualStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2 flex-wrap">
      {items.map((item) => {
        const tone = TONES[item.tone ?? 'indigo']
        // Only show spark/ring when caller supplies real series/pct — never invent
        const series = item.series?.length ? item.series : null
        const pct = item.pct
        return (
          <div
            key={item.label}
            className={`kpi-visual-card flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${tone.bg} border ${tone.border} shadow-sm min-w-[7.5rem] ring-1 ring-slate-950/[0.02]`}
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 leading-none truncate">
                {item.label}
              </span>
              <span className={`text-base sm:text-lg font-extrabold ${tone.text} tabular-nums leading-tight mt-0.5`}>
                {item.value}
              </span>
              {series ? (
                <div className="mt-0.5 hidden sm:block">
                  <SparkWave series={series} stroke={tone.stroke} fill={tone.fill} />
                </div>
              ) : null}
            </div>
            {pct != null ? <MiniDonut pct={pct} stroke={tone.stroke} /> : null}
          </div>
        )
      })}
    </div>
  )
}

/** Horizontal bar chart — pipeline / ranked lists */
export function PipelineBarChart({
  data,
  title,
}: {
  data: Record<string, number>
  title: string
}) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, n]) => n), 1)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title ? <p className="text-sm font-extrabold text-slate-900 mb-4">{title}</p> : null}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No pipeline data for this period yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([stage, count], i) => (
            <div key={stage}>
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
                <span className="tabular-nums">{count}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(count / max) * 100}%`, background: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Donut / pie composition */
export function FunnelDonut({
  title,
  slices,
}: {
  title: string
  slices: { label: string; value: number; color: string }[]
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1
  const r = 54
  const c = 2 * Math.PI * r
  const arcs = slices.reduce<{ label: string; color: string; len: number; offset: number }[]>((acc, s) => {
    const len = (s.value / total) * c
    const offset = acc.reduce((sum, a) => sum + a.len, 0)
    acc.push({ label: s.label, color: s.color, len, offset })
    return acc
  }, [])
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row items-center gap-6">
      <div>
        <p className="text-sm font-extrabold text-slate-900 mb-3">{title}</p>
        <svg width={140} height={140} viewBox="0 0 140 140" aria-hidden>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {arcs.map(a => (
            <circle
              key={a.label}
              cx="70" cy="70" r={r} fill="none"
              stroke={a.color} strokeWidth="18"
              strokeDasharray={`${a.len} ${c - a.len}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 70 70)"
            />
          ))}
          <text x="70" y="74" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 18, fontWeight: 800 }}>
            {slices.reduce((a, s) => a + s.value, 0)}
          </text>
        </svg>
      </div>
      <ul className="space-y-2 text-sm w-full">
        {slices.map(s => (
          <li key={s.label} className="flex items-center justify-between gap-3 font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Vertical column chart — trends / volume */
export function ColumnChart({
  title,
  series,
  color = '#4f46e5',
  height = 120,
}: {
  title?: string
  series: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  const max = Math.max(...series.map(s => s.value), 1)
  const last = series.slice(-14)
  return (
    <div className="w-full">
      {title ? <p className="text-xs font-extrabold text-slate-700 mb-2">{title}</p> : null}
      {last.length === 0 ? (
        <p className="text-[11px] text-slate-400 text-center py-6">No data</p>
      ) : (
        <div className="flex items-end gap-1" style={{ height }}>
          {last.map((d, i) => (
            <div key={`${d.label}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <span className="opacity-0 group-hover:opacity-100 absolute -top-5 text-[9px] font-bold text-slate-700 tabular-nums pointer-events-none">
                {d.value}
              </span>
              <div
                className="w-full rounded-t-sm transition-all min-h-[3px]"
                style={{
                  height: `${Math.max(4, (d.value / max) * 100)}%`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`,
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Area / line trend */
export function AreaTrendChart({
  title,
  series,
  color = '#0ea5e9',
  height = 72,
}: {
  title?: string
  series: number[]
  color?: string
  height?: number
}) {
  const w = 200
  const h = height
  if (!series.length) {
    return (
      <div className="w-full">
        {title ? <p className="text-xs font-extrabold text-slate-700 mb-1">{title}</p> : null}
        <p className="text-[11px] text-slate-400 text-center py-6">No data</p>
      </div>
    )
  }
  const data = series
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w
    const y = h - (v / max) * (h - 8) - 4
    return `${x},${y}`
  })
  const line = pts.join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <div className="w-full">
      {title ? <p className="text-xs font-extrabold text-slate-700 mb-1">{title}</p> : null}
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`area-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#area-${color.replace('#', '')})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** Classic BI funnel (trapezoid stages) */
export function FunnelPyramid({
  title,
  stages,
}: {
  title?: string
  stages: { label: string; value: number; color: string }[]
}) {
  const max = Math.max(...stages.map(s => s.value), 1)
  return (
    <div className="w-full">
      {title ? <p className="text-xs font-extrabold text-slate-700 mb-2">{title}</p> : null}
      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const pct = Math.max(18, (s.value / max) * 100)
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div className="flex-1 flex justify-center">
                <div
                  className="h-7 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm transition-all"
                  style={{
                    width: `${pct}%`,
                    background: s.color,
                    opacity: 1 - i * 0.04,
                  }}
                  title={`${s.label}: ${s.value}`}
                >
                  {s.value}
                </div>
              </div>
              <span className="w-20 text-[10px] font-bold text-slate-600 capitalize truncate">{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Gauge / KPI ring */
export function GaugeChart({
  value,
  max = 100,
  label,
  color = '#4f46e5',
  size = 88,
}: {
  value: number
  max?: number
  label?: string
  color?: string
  size?: number
}) {
  const r = 28
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : value))
  const dash = (pct / 100) * c * 0.75
  const track = c * 0.75
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
        <circle
          cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8"
          strokeDasharray={`${track} ${c}`}
          strokeLinecap="round"
          transform="rotate(135 44 44)"
        />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(135 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" style={{ fontSize: 16, fontWeight: 800, fill: '#0f172a' }}>
          {Number.isFinite(value) ? (max === 100 && value <= 100 ? `${Math.round(pct)}%` : value) : '—'}
        </text>
      </svg>
      {label ? <p className="text-[10px] font-bold text-slate-500 -mt-1">{label}</p> : null}
    </div>
  )
}

/** Compact stacked status bars */
export function StackedStatusBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[]
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  return (
    <div className="w-full">
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-100">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segments.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="tabular-nums text-slate-900">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Mini card preview chart picker for Reports grid */
export type ReportVisualKind =
  | 'area'
  | 'columns'
  | 'funnel'
  | 'donut'
  | 'bars'
  | 'gauge'
  | 'stacked'
  | 'scatter'

export function ReportCardVisual({
  kind,
  color,
  seed = 1,
  series,
  slices,
  gauge,
}: {
  kind: ReportVisualKind
  color: string
  seed?: number
  series?: number[]
  slices?: { label: string; value: number; color: string }[]
  gauge?: { value: number; max?: number }
}) {
  // Never invent decorative metrics — empty data must show an empty state
  void seed
  const data = series?.length ? series : []
  const empty = (
    <p className="text-[11px] text-slate-400 text-center py-4">No data</p>
  )

  if (kind === 'area') {
    if (!data.length) return empty
    return <AreaTrendChart series={data} color={color} height={56} />
  }
  if (kind === 'columns') {
    if (!data.length) return empty
    return (
      <ColumnChart
        series={data.map((v, i) => ({ label: `D${i + 1}`, value: v }))}
        color={color}
        height={56}
      />
    )
  }
  if (kind === 'funnel') {
    if (!slices?.length) return empty
    return <FunnelPyramid stages={slices.slice(0, 5)} />
  }
  if (kind === 'donut') {
    if (!slices?.length) return empty
    const s = slices
    const total = s.reduce((a, x) => a + x.value, 0) || 1
    const r = 22
    const circ = 2 * Math.PI * r
    const arcs = s.reduce<{ label: string; color: string; len: number; offset: number }[]>((acc, slice) => {
      const len = (slice.value / total) * circ
      const offset = acc.reduce((sum, a) => sum + a.len, 0)
      acc.push({ label: slice.label, color: slice.color, len, offset })
      return acc
    }, [])
    return (
      <div className="flex items-center gap-3">
        <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden>
          {arcs.map(a => (
            <circle
              key={a.label}
              cx="32" cy="32" r={r} fill="none"
              stroke={a.color} strokeWidth="10"
              strokeDasharray={`${a.len} ${circ - a.len}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 32 32)"
            />
          ))}
        </svg>
        <ul className="space-y-0.5">
          {s.slice(0, 4).map(slice => (
            <li key={slice.label} className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: slice.color }} />
              {slice.label}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (kind === 'bars') {
    if (!data.length) return empty
    const max = Math.max(...data, 1)
    return (
      <div className="space-y-1.5">
        {data.slice(0, 4).map((v, i) => (
          <div key={i} className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(v / max) * 100}%`, background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'gauge') {
    if (gauge == null && !data.length) return empty
    return (
      <div className="flex justify-center">
        <GaugeChart
          value={gauge?.value ?? 0}
          max={gauge?.max ?? 100}
          color={color}
          size={72}
        />
      </div>
    )
  }
  if (kind === 'stacked') {
    if (!slices?.length) return empty
    return <StackedStatusBar segments={slices} />
  }
  // scatter-ish dots as density visual — only when real series exists
  if (!data.length) return empty
  return (
    <svg width="100%" height={56} viewBox="0 0 120 56" aria-hidden>
      {data.slice(0, 12).map((v, i) => (
        <circle
          key={i}
          cx={8 + i * 9}
          cy={48 - (v / Math.max(...data, 1)) * 40}
          r={3 + (v % 3)}
          fill={color}
          opacity={0.55 + (i % 3) * 0.15}
        />
      ))}
    </svg>
  )
}

export { CHART_PALETTE }
