import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { computeRecruiterKpi, computeTenantFunnel } from '@/lib/kpiEngine'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

type ReportData = { filename: string; headers: string[]; rows: string[][] }

function csvResponse(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  return new NextResponse('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function xlsxResponse(filename: string, headers: string[], rows: string[][]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(row)
  sheet.getRow(1).font = { bold: true }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function pdfResponse(filename: string, headers: string[], rows: string[][]) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  doc.fontSize(14).text(filename.replace(/\.[^.]+$/, ''), { underline: true })
  doc.moveDown()

  const colWidth = Math.min(120, (doc.page.width - 80) / Math.max(headers.length, 1))
  doc.fontSize(9).font('Helvetica-Bold')
  headers.forEach((h, i) => doc.text(h, 40 + i * colWidth, doc.y, { width: colWidth - 4, continued: i < headers.length - 1 }))
  doc.moveDown(0.5)

  doc.font('Helvetica')
  for (const row of rows.slice(0, 200)) {
    const y = doc.y
    if (y > doc.page.height - 60) doc.addPage()
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), 40 + i * colWidth, doc.y === y ? y : doc.y, {
        width: colWidth - 4,
        continued: i < row.length - 1,
      })
    })
    doc.moveDown(0.4)
  }

  doc.end()
  const buffer = await finished
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function buildReport(
  type: string,
  days: number,
  tenantId: string,
  userId: string,
  tenantRole: string,
): Promise<ReportData | { error: string; status: number }> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const baseName = `${type}-report-${days}d`

  if (type === 'kpi') {
    const kpi = await computeRecruiterKpi({ tenantId, userId, days })
    return {
      filename: baseName,
      headers: ['Metric', 'Value'],
      rows: [
        ['Candidates Added', String(kpi.candidates_added)],
        ['AI Screened', String(kpi.candidates_screened)],
        ['Submissions', String(kpi.submissions)],
        ['Interviews Scheduled', String(kpi.interviews_scheduled)],
        ['Interviews Completed', String(kpi.interviews_completed)],
        ['Comms Sent', String(kpi.comms_sent)],
        ['Follow-ups Pending', String(kpi.follow_ups_pending)],
        ['Follow-ups Overdue', String(kpi.follow_ups_overdue)],
        ['Active Offers', String(kpi.offers_active)],
      ],
    }
  }

  if (type === 'funnel') {
    if (tenantRole !== 'owner' && tenantRole !== 'admin') {
      return { error: 'Invalid report type or forbidden', status: 400 }
    }
    const data = await computeTenantFunnel(tenantId, days)
    const rows: string[][] = []
    for (const [k, v] of Object.entries(data.funnel)) rows.push([k, String(v)])
    rows.push(['', ''])
    rows.push(['Submission Stage', 'Count'])
    for (const [k, v] of Object.entries(data.submission_stages)) rows.push([k, String(v)])
    return { filename: baseName, headers: ['Stage', 'Count'], rows }
  }

  if (type === 'interviews') {
    const { rows } = await pool.query(
      `SELECT short_id, candidate_name, candidate_email, status, scheduled_at, format, round, created_at
       FROM interviews WHERE tenant_id = $1 AND created_at >= $2 ORDER BY scheduled_at DESC`,
      [tenantId, since]
    )
    return {
      filename: baseName,
      headers: ['Interview ID', 'Candidate', 'Email', 'Status', 'Scheduled At', 'Format', 'Round', 'Created'],
      rows: rows.map(r => [
        r.short_id, r.candidate_name, r.candidate_email, r.status,
        r.scheduled_at ? new Date(r.scheduled_at).toISOString() : '',
        r.format ?? '', String(r.round ?? ''), r.created_at ? new Date(r.created_at).toISOString() : '',
      ]),
    }
  }

  if (type === 'offers' || type === 'joining' || type === 'drop') {
    let filter = ''
    if (type === 'joining') filter = ` AND status IN ('joined','joining_confirmed','no_show','onboarding','completed')`
    if (type === 'drop') filter = ` AND status IN ('dropped','offer_rejected','cancelled','no_show')`
    const { rows } = await pool.query(
      `SELECT o.short_id, o.status, o.offer_salary, o.expected_joining, o.offer_expiry,
              r.candidate_name, r.short_id AS candidate_id, o.created_at, o.updated_at
       FROM offer_cases o
       JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1 AND o.created_at >= $2 ${filter}
       ORDER BY o.updated_at DESC`,
      [tenantId, since]
    )
    return {
      filename: baseName,
      headers: ['Offer ID', 'Candidate', 'Candidate ID', 'Status', 'Salary', 'Joining', 'Expiry', 'Created', 'Updated'],
      rows: rows.map(r => [
        r.short_id ?? '', r.candidate_name, r.candidate_id, r.status,
        r.offer_salary ?? '', r.expected_joining ?? '', r.offer_expiry ?? '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.updated_at ? new Date(r.updated_at).toISOString() : '',
      ]),
    }
  }

  if (type === 'clients') {
    const { rows } = await pool.query(
      `SELECT COALESCE(client_name,'(blank)') AS client, stage, COUNT(*)::int AS n
       FROM submissions WHERE tenant_id = $1 AND created_at >= $2
       GROUP BY 1, 2 ORDER BY 1, 2`,
      [tenantId, since]
    )
    return {
      filename: baseName,
      headers: ['Client', 'Stage', 'Count'],
      rows: rows.map(r => [r.client, r.stage, String(r.n)]),
    }
  }

  if (type === 'sources') {
    const { rows } = await pool.query(
      `SELECT COALESCE(source_type,'(unknown)') AS source, COUNT(*)::int AS n
       FROM resumes WHERE tenant_id = $1 AND created_at >= $2
       GROUP BY 1 ORDER BY n DESC`,
      [tenantId, since]
    )
    return {
      filename: baseName,
      headers: ['Source', 'Count'],
      rows: rows.map(r => [r.source, String(r.n)]),
    }
  }

  if (type === 'visa') {
    const { rows } = await pool.query(
      `SELECT short_id, candidate_name, candidate_email,
              candidate_profile->>'visa_type' AS visa_type,
              candidate_profile->>'visa_expiry' AS visa_expiry,
              candidate_profile->>'nationality' AS nationality
       FROM resumes
       WHERE tenant_id = $1
         AND candidate_profile->>'visa_expiry' IS NOT NULL
         AND candidate_profile->>'visa_expiry' <> ''
       ORDER BY candidate_profile->>'visa_expiry' ASC`,
      [tenantId]
    )
    return {
      filename: 'visa-report',
      headers: ['Candidate ID', 'Name', 'Email', 'Visa Type', 'Visa Expiry', 'Nationality'],
      rows: rows.map(r => [r.short_id, r.candidate_name, r.candidate_email, r.visa_type, r.visa_expiry, r.nationality]),
    }
  }

  if (type === 'docs_expiry') {
    try {
      const { rows } = await pool.query(
        `SELECT cd.short_id, cd.slot_type, cd.expiry_date, cd.verification_status,
                r.short_id AS candidate_id, r.candidate_name
         FROM candidate_documents cd
         JOIN resumes r ON r.id = cd.resume_id
         WHERE cd.tenant_id = $1 AND cd.expiry_date IS NOT NULL
         ORDER BY cd.expiry_date ASC`,
        [tenantId]
      )
      return {
        filename: 'document-expiry',
        headers: ['Doc ID', 'Candidate ID', 'Candidate', 'Slot', 'Expiry', 'Verification'],
        rows: rows.map(r => [r.short_id, r.candidate_id, r.candidate_name, r.slot_type, r.expiry_date, r.verification_status]),
      }
    } catch {
      return { filename: 'document-expiry', headers: ['Doc ID', 'Candidate ID', 'Candidate', 'Slot', 'Expiry', 'Verification'], rows: [] }
    }
  }

  if (type === 'tth' || type === 'fill') {
    const kpi = await computeRecruiterKpi({ tenantId, userId, days })
    let tth = ''
    try {
      const { rows } = await pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - r.created_at)) / 86400)::float AS avg_days
         FROM offer_cases o JOIN resumes r ON r.id = o.resume_id
         WHERE o.tenant_id = $1 AND o.status IN ('joined','completed') AND o.updated_at >= $2`,
        [tenantId, since]
      )
      tth = String(rows[0]?.avg_days != null ? Math.round(rows[0].avg_days * 10) / 10 : '')
    } catch { /* ignore */ }
    const hired = kpi.pipeline_by_stage?.hired ?? 0
    const active = Object.values(kpi.pipeline_by_stage ?? {}).reduce((a, b) => a + b, 0)
    const fill = active > 0 ? Math.round((hired / active) * 100) : 0
    if (type === 'tth') {
      return {
        filename: baseName,
        headers: ['Metric', 'Value'],
        rows: [['Avg Time To Hire (days)', tth], ['Period Days', String(days)]],
      }
    }
    return {
      filename: baseName,
      headers: ['Metric', 'Value'],
      rows: [['Hired', String(hired)], ['Pipeline', String(active)], ['Fill Ratio %', String(fill)]],
    }
  }

  return { error: 'Invalid report type or forbidden', status: 400 }
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'reports.read')
  if (ctx instanceof NextResponse) return ctx

  const type = req.nextUrl.searchParams.get('type') ?? 'kpi'
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const format = (req.nextUrl.searchParams.get('format') ?? 'csv').toLowerCase()

  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

  const data = await buildReport(type, days, ctx.tenantId, ctx.userId, ctx.tenantRole)
  if ('error' in data) {
    return NextResponse.json({ error: data.error }, { status: data.status })
  }

  const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
  const filename = `${data.filename}.${ext}`

  if (format === 'xlsx') return xlsxResponse(filename, data.headers, data.rows)
  if (format === 'pdf') return pdfResponse(filename, data.headers, data.rows)
  return csvResponse(filename, data.headers, data.rows)
}
