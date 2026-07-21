/** Shared date range presets for Tekgen-style ops lists. */

export type DatePreset =
  | ''
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
]

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Returns inclusive calendar dates for SQL `::date` filters, or null for all-time. */
export function presetToRange(preset: DatePreset | string): { from: string; to: string } | null {
  if (!preset) return null
  const now = new Date()
  const today = startOfDay(now)

  if (preset === 'today') {
    const d = isoDate(today)
    return { from: d, to: d }
  }
  if (preset === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const d = isoDate(y)
    return { from: d, to: d }
  }
  if (preset === 'this_week') {
    const start = new Date(today)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
    return { from: isoDate(start), to: isoDate(today) }
  }
  if (preset === 'last_week') {
    const end = new Date(today)
    end.setDate(end.getDate() - ((end.getDay() + 6) % 7)) // this Monday
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    const lastSun = new Date(end)
    lastSun.setDate(lastSun.getDate() - 1)
    return { from: isoDate(start), to: isoDate(lastSun) }
  }
  if (preset === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: isoDate(start), to: isoDate(today) }
  }
  if (preset === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: isoDate(start), to: isoDate(end) }
  }
  if (preset === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1)
    return { from: isoDate(start), to: isoDate(today) }
  }
  if (preset === 'last_year') {
    const start = new Date(today.getFullYear() - 1, 0, 1)
    const end = new Date(today.getFullYear() - 1, 11, 31)
    return { from: isoDate(start), to: isoDate(end) }
  }
  return null
}

/** Append date filters to SQL conditions using a column expression (e.g. `s.submission_date` or `i.scheduled_at::date`). */
export function appendDateRangeSql(
  columnExpr: string,
  range: { from: string; to: string } | null,
  conditions: string[],
  params: unknown[],
  idx: number,
): number {
  if (!range) return idx
  conditions.push(`${columnExpr}::date >= $${idx}::date`)
  params.push(range.from)
  idx++
  conditions.push(`${columnExpr}::date <= $${idx}::date`)
  params.push(range.to)
  idx++
  return idx
}
