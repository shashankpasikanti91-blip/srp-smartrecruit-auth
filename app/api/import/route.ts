import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export const maxDuration = 30

// Column alias map — maps common CSV header variants to canonical field names
const COLUMN_MAP: Record<string, string> = {
  // name
  name: 'name', full_name: 'name', fullname: 'name', candidate_name: 'name',
  // email
  email: 'email', email_address: 'email', emailid: 'email',
  // phone
  phone: 'phone', mobile: 'phone', phone_number: 'phone', contact: 'phone',
  // location
  location: 'location', city: 'location', current_location: 'location',
  // experience
  experience: 'experience', exp: 'experience', years_of_experience: 'experience',
  total_experience: 'experience',
  // skills
  skills: 'skills', key_skills: 'skills', technical_skills: 'skills',
  // current_company
  current_company: 'current_company', company: 'current_company', employer: 'current_company',
  // current_title
  current_title: 'current_title', designation: 'current_title', title: 'current_title',
  job_title: 'current_title', position: 'current_title',
  // notice_period
  notice_period: 'notice_period', notice: 'notice_period', availability: 'notice_period',
  // salary
  current_salary: 'current_salary', ctc: 'current_salary', salary: 'current_salary',
  expected_salary: 'expected_salary', expected_ctc: 'expected_salary',
  // education
  education: 'education', qualification: 'education', degree: 'education',
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function normaliseHeaders(headers: string[]): string[] {
  return headers.map(h => {
    const key = h.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '')
    return COLUMN_MAP[key] ?? key
  })
}

function rowToCandidate(
  headers: string[],
  row: string[]
): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
  return obj
}

async function processImport(
  userId: string,
  batchId: string,
  headers: string[],
  rows: string[][]
): Promise<void> {
  let successCount = 0, skipped = 0, failed = 0

  for (let i = 0; i < rows.length; i++) {
    const rowData = rowToCandidate(headers, rows[i])
    const email = rowData.email?.trim().toLowerCase()
    const name = rowData.name?.trim()

    if (!email && !name) {
      failed++
      try {
        await pool.query(
          `INSERT INTO import_row_errors (batch_id, row_number, raw_data, error_message)
           VALUES ($1,$2,$3,$4)`,
          [batchId, i + 2, JSON.stringify(rowData), 'Missing both email and name — row skipped']
        )
      } catch { /* silent */ }
      continue
    }

    // Build extra data for ai_summary storage
    const extraData = {
      experience: rowData.experience,
      skills: rowData.skills,
      current_company: rowData.current_company,
      current_title: rowData.current_title,
      notice_period: rowData.notice_period,
      current_salary: rowData.current_salary,
      expected_salary: rowData.expected_salary,
      education: rowData.education,
      location: rowData.location,
    }

    try {
      // Check duplicate
      let existing: { id: string } | undefined
      if (email) {
        const dup = await pool.query<{ id: string }>(
          `SELECT id FROM resumes WHERE candidate_email = $1 AND user_id = $2 LIMIT 1`,
          [email, userId]
        )
        existing = dup.rows[0]
      }

      if (existing) {
        // Merge — update what is now present
        await pool.query(
          `UPDATE resumes SET
             candidate_name = COALESCE(NULLIF($1,''), candidate_name),
             candidate_phone = COALESCE(NULLIF($2,''), candidate_phone),
             full_ai_analysis = $3,
             source_batch_id = $4,
             updated_at = NOW()
           WHERE id = $5 AND user_id = $6`,
          [name, rowData.phone, JSON.stringify(extraData), batchId, existing.id, userId]
        )
        skipped++
      } else {
        // Create new candidate
        await pool.query(
          `INSERT INTO resumes
             (user_id, candidate_name, candidate_email, candidate_phone,
              source_type, source_batch_id, full_ai_analysis,
              pipeline_stage, status)
           VALUES ($1,$2,$3,$4,'import',$5,$6,'applied','pending')`,
          [
            userId, name ?? '', email ?? '', rowData.phone ?? '',
            batchId, JSON.stringify(extraData),
          ]
        )
        successCount++
      }
    } catch (rowErr) {
      failed++
      try {
        await pool.query(
          `INSERT INTO import_row_errors (batch_id, row_number, raw_data, error_message)
           VALUES ($1,$2,$3,$4)`,
          [batchId, i + 2, JSON.stringify(rowData),
           rowErr instanceof Error ? rowErr.message : 'DB error']
        )
      } catch { /* silent */ }
    }
  }

  // Update batch summary
  await pool.query(
    `UPDATE import_batches
     SET status = $1, processed_rows = $2, success_rows = $3,
         skipped_rows = $4, error_rows = $5, finished_at = NOW()
     WHERE id = $6`,
    [failed > 0 && successCount === 0 ? 'failed' : 'complete',
     rows.length, successCount, skipped, failed, batchId]
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
    }

    const content = await file.text()
    const { headers: rawHeaders, rows } = parseCSV(content)
    if (!rawHeaders.length) {
      return NextResponse.json({ error: 'CSV file is empty or has no headers' }, { status: 400 })
    }
    const headers = normaliseHeaders(rawHeaders)

    // Create batch record (import_type required by CHECK constraint)
    const batchRes = await pool.query<{ id: string; batch_ref: string }>(
      `INSERT INTO import_batches
         (user_id, file_name, total_rows, status, import_type, source_label, started_at)
       VALUES ($1,$2,$3,'processing','candidates_csv','Direct Upload', NOW()) RETURNING id, batch_ref`,
      [userId, file.name, rows.length]
    )
    const batchId = batchRes.rows[0].id
    const ref = batchRes.rows[0].batch_ref

    // Process in background (fire-and-forget, not awaited)
    processImport(userId, batchId, headers, rows).catch(e =>
      console.error('[import] Background processing error:', e)
    )

    return NextResponse.json({
      batch_id: batchId,
      batch_ref: ref,
      total_rows: rows.length,
      detected_columns: headers,
      status: 'processing',
      message: `Import started. Batch ID: ${batchId}. Check /api/import?batch_id=${batchId} for status.`,
    }, { status: 202 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  const url = new URL(req.url)
  const batchId = url.searchParams.get('batch_id')

  try {
    if (batchId) {
      const bRes = await pool.query(
        `SELECT id, file_name AS filename, batch_ref, status, total_rows, processed_rows,
                success_rows, skipped_rows, error_rows, created_at, finished_at
         FROM import_batches WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [batchId, userId]
      )
      if (!bRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const errRes = await pool.query(
        `SELECT row_number, raw_data, error_message FROM import_row_errors
         WHERE batch_id = $1 ORDER BY row_number LIMIT 100`,
        [batchId]
      )
      return NextResponse.json({ batch: bRes.rows[0], errors: errRes.rows })
    }

    if (url.searchParams.get('column_map') === 'true') {
      return NextResponse.json({ column_map: COLUMN_MAP })
    }

    const { rows } = await pool.query(
      `SELECT id, file_name AS filename, batch_ref, status, total_rows, processed_rows,
              success_rows, skipped_rows, error_rows, created_at, finished_at
       FROM import_batches WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    )
    return NextResponse.json({ batches: rows })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
