import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import type { TenantContext } from '@/lib/tenant'
import { presetToRange, type DatePreset } from '@/lib/datePresets'

export function resolveMineScope(
  ctx: Pick<TenantContext, 'tenantRole' | 'userId'>,
  mineParam: string | null,
): { mine: boolean; canToggle: boolean } {
  const canToggle = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'
  if (!canToggle) return { mine: true, canToggle: false }
  return { mine: mineParam === '1', canToggle: true }
}

export function resolveDateFilter(searchParams: URLSearchParams): { from: string; to: string } | null {
  const from = searchParams.get('date_from')?.trim() || ''
  const to = searchParams.get('date_to')?.trim() || ''
  if (from || to) {
    return {
      from: from || '1970-01-01',
      to: to || '2999-12-31',
    }
  }
  const preset = (searchParams.get('date_range') ?? '') as DatePreset
  return presetToRange(preset)
}

export function csvDownload(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  return new NextResponse('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function xlsxDownload(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(row.map(c => (c == null ? '' : c)))
  sheet.getRow(1).font = { bold: true }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/** Feedback buckets mapped from submission stages */
export const SUBMISSION_FEEDBACK_BUCKETS: Record<string, string[]> = {
  awaiting: [
    'draft', 'submitted', 'client_review', 'interview', 'interview_completed', 'waiting_feedback',
  ],
  positive: [
    'shortlisted', 'selected', 'offer', 'offer_released', 'offer_accepted', 'joined',
  ],
  kiv: ['hold', 'position_closed', 'duplicate'],
  rejected: [
    'rejected', 'rejected_by_candidate', 'submission_withdrawn', 'offer_declined', 'no_show',
  ],
}

export function stagesForFeedbackBucket(bucket: string): string[] | null {
  if (!bucket || bucket === 'all') return null
  return SUBMISSION_FEEDBACK_BUCKETS[bucket] ?? null
}

/** Derive docs status from offer stage + slot completion. */
export function deriveDocsStatus(
  status: string,
  filled: number,
  total: number,
  explicit?: string | null,
): 'not_started' | 'collecting' | 'with_hr' | 'clearance_done' | 'onboarding' {
  if (
    explicit === 'not_started' || explicit === 'collecting' || explicit === 'with_hr'
    || explicit === 'clearance_done' || explicit === 'onboarding'
  ) {
    return explicit
  }
  if (status === 'onboarding' || status === 'probation') return 'onboarding'
  if (status === 'document_verification' || status === 'background_verification') return 'with_hr'
  if (['offer_draft', 'offer_released', 'offer_signed', 'offer_accepted', 'joined', 'completed', 'onboarding', 'probation'].includes(status)) {
    return total > 0 && filled >= total ? 'clearance_done' : 'with_hr'
  }
  if (status === 'document_collection' || filled > 0) return 'collecting'
  return 'not_started'
}

export type HrOpsMeta = {
  hr_discussion?: string
  budget_ok?: boolean
  offer_letter?: string
  joined_status?: string
  joined_date?: string | null
}

export function parseHrOps(breakdown: unknown, remarks?: string | null): HrOpsMeta {
  const base: HrOpsMeta = {}
  if (breakdown && typeof breakdown === 'object' && !Array.isArray(breakdown)) {
    const b = breakdown as Record<string, unknown>
    const ops = (b.hr_ops && typeof b.hr_ops === 'object' ? b.hr_ops : b) as Record<string, unknown>
    if (typeof ops.hr_discussion === 'string') base.hr_discussion = ops.hr_discussion
    if (typeof ops.budget_ok === 'boolean') base.budget_ok = ops.budget_ok
    if (typeof ops.offer_letter === 'string') base.offer_letter = ops.offer_letter
    if (typeof ops.joined_status === 'string') base.joined_status = ops.joined_status
    if (ops.joined_date != null) base.joined_date = String(ops.joined_date)
  }
  const rem = remarks ?? ''
  const hd = rem.match(/hr_discussion:([^\s]+)/)
  if (hd && !base.hr_discussion) base.hr_discussion = hd[1]
  const ol = rem.match(/offer_letter:([^\s]+)/)
  if (ol && !base.offer_letter) base.offer_letter = ol[1]
  if (/budget_ok:1\b/.test(rem)) base.budget_ok = true
  return base
}

export function mergeHrOps(existing: unknown, patch: HrOpsMeta): Record<string, unknown> {
  const prev = (existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}) as Record<string, unknown>
  const prevOps = (prev.hr_ops && typeof prev.hr_ops === 'object'
    ? { ...(prev.hr_ops as Record<string, unknown>) }
    : {}) as Record<string, unknown>
  return {
    ...prev,
    hr_ops: { ...prevOps, ...patch },
  }
}

export function parseSubmissionFeedback(feedback: unknown): {
  detail: string | null
  recorded_by: string | null
  feedback_date: string | null
} {
  if (!feedback || typeof feedback !== 'object') {
    return { detail: null, recorded_by: null, feedback_date: null }
  }
  const f = feedback as Record<string, unknown>
  const detail = typeof f.detail === 'string' ? f.detail
    : typeof f.text === 'string' ? f.text
      : typeof f.notes === 'string' ? f.notes
        : null
  const recorded_by = typeof f.recorded_by === 'string' ? f.recorded_by
    : typeof f.by === 'string' ? f.by
      : null
  const feedback_date = typeof f.recorded_at === 'string' ? f.recorded_at
    : typeof f.updated_at === 'string' ? f.updated_at
      : typeof f.date === 'string' ? f.date
        : null
  return { detail, recorded_by, feedback_date }
}

export function formatIsoDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const x = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(x.getTime())) return ''
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatIsoTime(d: string | Date | null | undefined): string {
  if (!d) return ''
  const x = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(x.getTime())) return ''
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

export function formatExpYears(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  const s = String(v).trim()
  if (!s) return '—'
  if (/y$/i.test(s)) return s
  const n = Number(s)
  if (!Number.isNaN(n)) return `${n}y`
  return s
}
